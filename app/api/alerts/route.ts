import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  return route(async () => {
    const ctx = await requireCtx();
    const rows = db
      .select()
      .from(schema.alerts)
      .where(eq(schema.alerts.workspaceId, ctx.workspaceId))
      .orderBy(desc(schema.alerts.createdAt))
      .all();
    return json({ alerts: rows });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const { name, generatedSql, condition, scheduleCron, notificationTarget, dataSourceId } = await req.json();
    if (!name) return fail("Alert name is required.");
    const alert = db
      .insert(schema.alerts)
      .values({
        workspaceId: ctx.workspaceId,
        name,
        generatedSql: generatedSql ?? null,
        conditionJson: condition ? JSON.stringify(condition) : null,
        scheduleCron: scheduleCron ?? "0 8 * * *",
        notificationTarget: notificationTarget ?? null,
        dataSourceId: dataSourceId ?? null,
        enabled: true,
        createdByUserId: ctx.user.id,
      })
      .returning()
      .get();
    return json({ alert });
  });
}
