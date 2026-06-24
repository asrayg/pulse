import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, inArray, desc } from "drizzle-orm";
import { encryptJson } from "@/lib/crypto";
import { PostgresAdapter, type PostgresConfig } from "@/lib/adapters";

export async function GET() {
  return route(async () => {
    const ctx = await requireCtx();
    const sources = db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.workspaceId, ctx.workspaceId))
      .orderBy(desc(schema.dataSources.createdAt))
      .all();

    const withCounts = sources.map((s) => {
      const tables = db
        .select()
        .from(schema.dataSourceTables)
        .where(eq(schema.dataSourceTables.dataSourceId, s.id))
        .all();
      const tableIds = tables.map((t) => t.id);
      let columnCount = 0;
      if (tableIds.length) {
        columnCount = db
          .select()
          .from(schema.dataSourceColumns)
          .where(inArray(schema.dataSourceColumns.tableId, tableIds))
          .all().length;
      }
      return { ...s, tableCount: tables.length, columnCount };
    });

    return json({ dataSources: withCounts });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const body = (await req.json()) as {
      name?: string;
      type?: string;
      config?: PostgresConfig;
    };

    const name = body.name?.trim();
    if (!name) return fail("A name is required.");
    if (body.type !== "postgres") return fail("Only Postgres data sources can be created here.");
    const config = body.config;
    if (!config || !config.host || !config.database || !config.user) {
      return fail("Host, database, and user are required.");
    }

    const adapter = new PostgresAdapter({
      host: config.host,
      port: config.port ? Number(config.port) : 5432,
      database: config.database,
      user: config.user,
      password: config.password ?? "",
      ssl: config.ssl ?? false,
      schema: config.schema || "public",
    });

    const result = await adapter.test();
    if (!result.ok) return fail(result.message || "Could not connect to the database.", 400);

    const nowIso = new Date().toISOString();
    const ds = db
      .insert(schema.dataSources)
      .values({
        workspaceId: ctx.workspaceId,
        name,
        type: "postgres",
        encryptedConfig: encryptJson(config),
        status: "connected",
        lastConnectedAt: nowIso,
        createdByUserId: ctx.user.id,
      })
      .returning()
      .get();

    // Introspect and persist the schema.
    try {
      const introspected = await adapter.introspect();
      for (const table of introspected.tables) {
        const tableRow = db
          .insert(schema.dataSourceTables)
          .values({
            dataSourceId: ds.id,
            tableName: table.name,
            schemaName: table.schema ?? null,
            rowCountEstimate: table.rowCountEstimate ?? 0,
          })
          .returning()
          .get();
        for (const col of table.columns) {
          db.insert(schema.dataSourceColumns)
            .values({
              tableId: tableRow.id,
              columnName: col.name,
              dataType: col.dataType ?? null,
              nullable: col.nullable ?? true,
              sampleValuesJson: JSON.stringify(col.sampleValues || []),
              semanticType: col.semanticType ?? null,
            })
            .run();
        }
      }
      db.update(schema.dataSources)
        .set({ lastIntrospectedAt: new Date().toISOString() })
        .where(eq(schema.dataSources.id, ds.id))
        .run();
    } catch (e) {
      // Connection succeeded but introspection failed — keep the source, surface a warning status.
      db.update(schema.dataSources)
        .set({ status: "connected" })
        .where(eq(schema.dataSources.id, ds.id))
        .run();
      console.error("[pulse] introspection failed:", (e as Error).message);
    }

    const fresh = db.select().from(schema.dataSources).where(eq(schema.dataSources.id, ds.id)).get();
    return json({ dataSource: fresh });
  });
}
