import { requireCtx, json, route, fail, getDataSource } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, inArray, asc } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const ds = getDataSource(ctx.workspaceId, id);
    if (!ds) return fail("Data source not found", 404);

    const tables = db
      .select()
      .from(schema.dataSourceTables)
      .where(eq(schema.dataSourceTables.dataSourceId, ds.id))
      .orderBy(asc(schema.dataSourceTables.tableName))
      .all();

    const tableIds = tables.map((t) => t.id);
    const cols = tableIds.length
      ? db
          .select()
          .from(schema.dataSourceColumns)
          .where(inArray(schema.dataSourceColumns.tableId, tableIds))
          .all()
      : [];

    const colsByTable = new Map<string, typeof cols>();
    for (const c of cols) {
      if (!colsByTable.has(c.tableId)) colsByTable.set(c.tableId, []);
      colsByTable.get(c.tableId)!.push(c);
    }

    const schemaTables = tables.map((t) => ({
      id: t.id,
      tableName: t.tableName,
      rowCountEstimate: t.rowCountEstimate ?? 0,
      columns: (colsByTable.get(t.id) ?? []).map((c) => {
        let sampleValues: unknown[] = [];
        if (c.sampleValuesJson) {
          try {
            const parsed = JSON.parse(c.sampleValuesJson);
            if (Array.isArray(parsed)) sampleValues = parsed;
          } catch {
            sampleValues = [];
          }
        }
        return {
          columnName: c.columnName,
          dataType: c.dataType,
          nullable: c.nullable,
          semanticType: c.semanticType,
          sampleValues,
        };
      }),
    }));

    return json({ dataSource: ds, schema: { tables: schemaTables } });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const ds = getDataSource(ctx.workspaceId, id);
    if (!ds) return fail("Data source not found", 404);
    if (ds.type === "demo") return fail("The demo data source cannot be deleted.", 400);

    const tables = db
      .select()
      .from(schema.dataSourceTables)
      .where(eq(schema.dataSourceTables.dataSourceId, ds.id))
      .all();
    const tableIds = tables.map((t) => t.id);
    if (tableIds.length) {
      db.delete(schema.dataSourceColumns).where(inArray(schema.dataSourceColumns.tableId, tableIds)).run();
    }
    db.delete(schema.dataSourceTables).where(eq(schema.dataSourceTables.dataSourceId, ds.id)).run();
    db.delete(schema.dataSources).where(eq(schema.dataSources.id, ds.id)).run();

    return json({ ok: true });
  });
}
