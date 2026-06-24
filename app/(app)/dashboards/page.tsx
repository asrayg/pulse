import { redirect } from "next/navigation";
import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { DashboardsIndex } from "@/components/dashboard/dashboards-index";

export default async function DashboardsPage() {
  const ctx = await getCtx();
  if (!ctx?.workspaceId) redirect("/login");

  const rows = db.select().from(schema.dashboards).where(eq(schema.dashboards.workspaceId, ctx.workspaceId)).orderBy(desc(schema.dashboards.updatedAt)).all();
  const dashboards = rows.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    updatedAt: d.updatedAt,
    tileCount: db.select().from(schema.dashboardTiles).where(eq(schema.dashboardTiles.dashboardId, d.id)).all().length,
  }));

  return <DashboardsIndex dashboards={dashboards} />;
}
