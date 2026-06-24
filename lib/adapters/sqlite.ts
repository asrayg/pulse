import "server-only";
import Database from "better-sqlite3";
import type { DbAdapter, DataSourceSchema, QueryResult, SchemaTable } from "@/lib/types";
import { inferSemanticType, inferRelationships } from "./infer";

/**
 * Read-only SQLite adapter. Backs both the seeded demo dataset and uploaded
 * CSVs (which are materialized into a per-file .db). Opened readonly so the
 * connection physically cannot mutate data.
 */
export class SqliteAdapter implements DbAdapter {
  type: DbAdapter["type"];
  dialect = "sqlite" as const;
  private path: string;

  constructor(path: string, type: DbAdapter["type"] = "sqlite") {
    this.path = path;
    this.type = type;
  }

  private open() {
    const db = new Database(this.path, { readonly: true, fileMustExist: true });
    db.pragma("query_only = ON");
    return db;
  }

  async test() {
    try {
      const db = this.open();
      db.prepare("SELECT 1").get();
      db.close();
      return { ok: true, message: "Connected." };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  async introspect(): Promise<DataSourceSchema> {
    const db = this.open();
    try {
      const tableRows = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string }[];

      const tables: SchemaTable[] = [];
      for (const { name } of tableRows) {
        const cols = db.prepare(`PRAGMA table_info("${name}")`).all() as {
          name: string;
          type: string;
          notnull: number;
        }[];
        const countRow = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get() as { c: number };
        const sampleRows = db.prepare(`SELECT * FROM "${name}" LIMIT 25`).all() as Record<string, unknown>[];

        tables.push({
          name,
          rowCountEstimate: countRow.c,
          columns: cols.map((c) => {
            const samples = sampleRows
              .map((r) => r[c.name] as string | number | null)
              .filter((v) => v !== undefined)
              .slice(0, 8);
            return {
              name: c.name,
              dataType: c.type || "TEXT",
              nullable: c.notnull === 0,
              sampleValues: samples,
              semanticType: inferSemanticType(c.name, c.type, samples),
            };
          }),
        });
      }
      const relationships = inferRelationships(
        tables.map((t) => ({ name: t.name, columns: t.columns.map((c) => ({ name: c.name })) })),
      );
      return { tables, relationships };
    } finally {
      db.close();
    }
  }

  async run(sql: string, opts?: { maxRows?: number; timeoutMs?: number }): Promise<QueryResult> {
    const db = this.open();
    const maxRows = opts?.maxRows ?? 5000;
    const started = Date.now();
    try {
      // Interrupt long-running queries.
      const timeout = opts?.timeoutMs ?? 15000;
      const timer = setTimeout(() => {
        try {
          db.close();
        } catch {
          /* noop */
        }
      }, timeout);

      const stmt = db.prepare(sql);
      stmt.raw(false);
      let rows = stmt.all() as Record<string, string | number | boolean | null>[];
      clearTimeout(timer);

      const truncated = rows.length > maxRows;
      if (truncated) rows = rows.slice(0, maxRows);
      const columns = rows.length ? Object.keys(rows[0]) : columnsFromStatement(stmt);

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - started,
        truncated,
      };
    } finally {
      try {
        db.close();
      } catch {
        /* already closed by timeout */
      }
    }
  }
}

function columnsFromStatement(stmt: Database.Statement): string[] {
  try {
    return stmt.columns().map((c) => c.name);
  } catch {
    return [];
  }
}
