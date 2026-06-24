import { redirect, notFound } from "next/navigation";
import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq, asc } from "drizzle-orm";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx?.workspaceId) redirect("/login");
  const { id } = await params;

  const dashboard = db
    .select()
    .from(schema.dashboards)
    .where(and(eq(schema.dashboards.id, id), eq(schema.dashboards.workspaceId, ctx.workspaceId)))
    .get();
  if (!dashboard) notFound();

  const tiles = db
    .select()
    .from(schema.dashboardTiles)
    .where(eq(schema.dashboardTiles.dashboardId, id))
    .orderBy(asc(schema.dashboardTiles.position))
    .all();

  return (
    <DashboardView
      dashboard={{ id: dashboard.id, title: dashboard.title, description: dashboard.description, summary: dashboard.summary }}
      tiles={tiles.map((t) => ({ id: t.id, title: t.title, tileType: t.tileType, generatedSql: t.generatedSql, chartConfigJson: t.chartConfigJson, dataSourceId: t.dataSourceId, explanation: t.explanation }))}
    />
  );
}
