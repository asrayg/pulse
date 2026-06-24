import { redirect } from "next/navigation";
import { getCtx, defaultDataSource } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { AlertsIndex } from "@/components/alerts/alerts-index";

export default async function AlertsPage() {
  const ctx = await getCtx();
  if (!ctx?.workspaceId) redirect("/login");

  const rows = db
    .select()
    .from(schema.alerts)
    .where(eq(schema.alerts.workspaceId, ctx.workspaceId))
    .orderBy(desc(schema.alerts.createdAt))
    .all();

  const alerts = rows.map((a) => ({
    id: a.id,
    name: a.name,
    conditionJson: a.conditionJson,
    scheduleCron: a.scheduleCron,
    notificationTarget: a.notificationTarget,
    enabled: !!a.enabled,
    lastStatus: a.lastStatus,
    lastCheckedAt: a.lastCheckedAt,
  }));

  const ds = defaultDataSource(ctx.workspaceId);

  return <AlertsIndex alerts={alerts} dataSourceId={ds?.id ?? null} />;
}
