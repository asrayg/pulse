import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const alert = db
      .select()
      .from(schema.alerts)
      .where(and(eq(schema.alerts.id, id), eq(schema.alerts.workspaceId, ctx.workspaceId)))
      .get();
    if (!alert) return fail("Alert not found.", 404);

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name;
    if (body.condition !== undefined) updates.conditionJson = body.condition ? JSON.stringify(body.condition) : null;
    if (typeof body.scheduleCron === "string") updates.scheduleCron = body.scheduleCron;
    if (body.notificationTarget !== undefined) updates.notificationTarget = body.notificationTarget ?? null;
    if (typeof body.generatedSql === "string") updates.generatedSql = body.generatedSql;

    db.update(schema.alerts).set(updates).where(eq(schema.alerts.id, id)).run();
    const updated = db.select().from(schema.alerts).where(eq(schema.alerts.id, id)).get();
    return json({ alert: updated });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const alert = db
      .select()
      .from(schema.alerts)
      .where(and(eq(schema.alerts.id, id), eq(schema.alerts.workspaceId, ctx.workspaceId)))
      .get();
    if (!alert) return fail("Alert not found.", 404);
    db.delete(schema.alerts).where(eq(schema.alerts.id, id)).run();
    return json({ ok: true });
  });
}
