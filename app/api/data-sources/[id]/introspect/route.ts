import { requireCtx, json, route, fail, getDataSource } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { getAdapter } from "@/lib/adapters";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const ds = getDataSource(ctx.workspaceId, id);
    if (!ds) return fail("Data source not found", 404);

    const adapter = getAdapter(ds);
    const introspected = await adapter.introspect();

    // Replace existing stored tables/columns for this source.
    const existing = db
      .select()
      .from(schema.dataSourceTables)
      .where(eq(schema.dataSourceTables.dataSourceId, ds.id))
      .all();
    const existingIds = existing.map((t) => t.id);
    if (existingIds.length) {
      db.delete(schema.dataSourceColumns).where(inArray(schema.dataSourceColumns.tableId, existingIds)).run();
    }
    db.delete(schema.dataSourceTables).where(eq(schema.dataSourceTables.dataSourceId, ds.id)).run();

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

    return json({ tableCount: introspected.tables.length });
  });
}
