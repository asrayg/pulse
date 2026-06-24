import { redirect } from "next/navigation";
import { getCtx, defaultDataSource } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc, asc } from "drizzle-orm";
import { SemanticLayer } from "@/components/semantic/semantic-layer";

export default async function SemanticLayerPage() {
  const ctx = await getCtx();
  if (!ctx?.workspaceId) redirect("/login");

  const metrics = db
    .select()
    .from(schema.metrics)
    .where(eq(schema.metrics.workspaceId, ctx.workspaceId))
    .orderBy(desc(schema.metrics.createdAt))
    .all();

  const dimensions = db
    .select()
    .from(schema.dimensions)
    .where(eq(schema.dimensions.workspaceId, ctx.workspaceId))
    .orderBy(desc(schema.dimensions.createdAt))
    .all();

  const ds = defaultDataSource(ctx.workspaceId);
  let tables: { tableName: string; columns: string[] }[] = [];
  if (ds) {
    const tableRows = db
      .select()
      .from(schema.dataSourceTables)
      .where(eq(schema.dataSourceTables.dataSourceId, ds.id))
      .orderBy(asc(schema.dataSourceTables.tableName))
      .all();
    tables = tableRows.map((t) => ({
      tableName: t.tableName,
      columns: db
        .select()
        .from(schema.dataSourceColumns)
        .where(eq(schema.dataSourceColumns.tableId, t.id))
        .orderBy(asc(schema.dataSourceColumns.columnName))
        .all()
        .map((c) => c.columnName),
    }));
  }

  return <SemanticLayer metrics={metrics} dimensions={dimensions} tables={tables} />;
}
