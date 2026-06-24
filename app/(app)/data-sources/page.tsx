import { redirect } from "next/navigation";
import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, inArray, desc } from "drizzle-orm";
import { DataSourcesIndex } from "@/components/data-sources/data-sources-index";

export default async function DataSourcesPage() {
  const ctx = await getCtx();
  if (!ctx?.workspaceId) redirect("/login");

  const rows = db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.workspaceId, ctx.workspaceId))
    .orderBy(desc(schema.dataSources.createdAt))
    .all();

  const sources = rows.map((s) => {
    const tables = db
      .select()
      .from(schema.dataSourceTables)
      .where(eq(schema.dataSourceTables.dataSourceId, s.id))
      .all();
    const tableIds = tables.map((t) => t.id);
    const columnCount = tableIds.length
      ? db
          .select()
          .from(schema.dataSourceColumns)
          .where(inArray(schema.dataSourceColumns.tableId, tableIds))
          .all().length
      : 0;
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      status: s.status,
      lastConnectedAt: s.lastConnectedAt,
      lastIntrospectedAt: s.lastIntrospectedAt,
      tableCount: tables.length,
      columnCount,
    };
  });

  return <DataSourcesIndex sources={sources} />;
}
