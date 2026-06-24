import "server-only";
import { Client } from "pg";
import type { DbAdapter, DataSourceSchema, QueryResult, SchemaTable } from "@/lib/types";
import { inferSemanticType, inferRelationships } from "./infer";

export interface PostgresConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  schema?: string;
}

/** Read-only Postgres adapter. Every session sets read-only + statement timeout. */
export class PostgresAdapter implements DbAdapter {
  type = "postgres" as const;
  dialect = "postgres" as const;
  private cfg: PostgresConfig;

  constructor(cfg: PostgresConfig) {
    this.cfg = cfg;
  }

  private async connect() {
    const client = new Client({
      host: this.cfg.host,
      port: this.cfg.port ?? 5432,
      database: this.cfg.database,
      user: this.cfg.user,
      password: this.cfg.password,
      ssl: this.cfg.ssl ? { rejectUnauthorized: false } : undefined,
      statement_timeout: 15000,
      connectionTimeoutMillis: 8000,
    });
    await client.connect();
    await client.query("SET default_transaction_read_only = on");
    await client.query("SET statement_timeout = 15000");
    return client;
  }

  async test() {
    let client: Client | undefined;
    try {
      client = await this.connect();
      await client.query("SELECT 1");
      return { ok: true, message: "Connected." };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    } finally {
      await client?.end().catch(() => {});
    }
  }

  async introspect(): Promise<DataSourceSchema> {
    const schema = this.cfg.schema ?? "public";
    const client = await this.connect();
    try {
      const colsRes = await client.query(
        `SELECT table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1
         ORDER BY table_name, ordinal_position`,
        [schema],
      );
      const byTable = new Map<string, { column_name: string; data_type: string; is_nullable: string }[]>();
      for (const r of colsRes.rows) {
        if (!byTable.has(r.table_name)) byTable.set(r.table_name, []);
        byTable.get(r.table_name)!.push(r);
      }

      const tables: SchemaTable[] = [];
      for (const [tableName, cols] of byTable) {
        let samples: Record<string, unknown>[] = [];
        let rowCount = 0;
        try {
          const sample = await client.query(`SELECT * FROM "${schema}"."${tableName}" LIMIT 20`);
          samples = sample.rows;
          const cnt = await client.query(`SELECT reltuples::bigint AS c FROM pg_class WHERE relname = $1`, [tableName]);
          rowCount = Number(cnt.rows[0]?.c ?? 0);
        } catch {
          /* permission or view — skip sampling */
        }
        tables.push({
          name: tableName,
          schema,
          rowCountEstimate: rowCount,
          columns: cols.map((c) => {
            const sv = samples
              .map((r) => r[c.column_name] as string | number | null)
              .filter((v) => v !== undefined)
              .slice(0, 8);
            return {
              name: c.column_name,
              dataType: c.data_type,
              nullable: c.is_nullable === "YES",
              sampleValues: sv,
              semanticType: inferSemanticType(c.column_name, c.data_type, sv),
            };
          }),
        });
      }
      const relationships = inferRelationships(
        tables.map((t) => ({ name: t.name, columns: t.columns.map((c) => ({ name: c.name })) })),
      );
      return { tables, relationships };
    } finally {
      await client.end().catch(() => {});
    }
  }

  async run(sql: string, opts?: { maxRows?: number }): Promise<QueryResult> {
    const client = await this.connect();
    const started = Date.now();
    const maxRows = opts?.maxRows ?? 5000;
    try {
      const res = await client.query(sql);
      let rows = res.rows as Record<string, string | number | boolean | null>[];
      const truncated = rows.length > maxRows;
      if (truncated) rows = rows.slice(0, maxRows);
      const columns = res.fields?.map((f) => f.name) ?? (rows[0] ? Object.keys(rows[0]) : []);
      return { columns, rows, rowCount: rows.length, executionTimeMs: Date.now() - started, truncated };
    } finally {
      await client.end().catch(() => {});
    }
  }
}
