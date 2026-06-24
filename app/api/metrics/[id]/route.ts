import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const existing = db
      .select()
      .from(schema.metrics)
      .where(and(eq(schema.metrics.id, id), eq(schema.metrics.workspaceId, ctx.workspaceId)))
      .get();
    if (!existing) return fail("Metric not found.", 404);

    const body = await req.json();
    const updates: Partial<typeof schema.metrics.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.displayName === "string") updates.displayName = body.displayName;
    if (body.description !== undefined) updates.description = body.description ?? null;
    if (typeof body.sqlExpression === "string") updates.sqlExpression = body.sqlExpression;
    if (body.baseTable !== undefined) updates.baseTable = body.baseTable ?? null;
    if (body.synonyms !== undefined) updates.synonymsJson = JSON.stringify(Array.isArray(body.synonyms) ? body.synonyms : []);
    if (body.verified !== undefined) updates.verified = Boolean(body.verified);

    const metric = db
      .update(schema.metrics)
      .set(updates)
      .where(and(eq(schema.metrics.id, id), eq(schema.metrics.workspaceId, ctx.workspaceId)))
      .returning()
      .get();
    return json({ metric });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const existing = db
      .select()
      .from(schema.metrics)
      .where(and(eq(schema.metrics.id, id), eq(schema.metrics.workspaceId, ctx.workspaceId)))
      .get();
    if (!existing) return fail("Metric not found.", 404);
    db.delete(schema.metrics).where(eq(schema.metrics.id, id)).run();
    return json({ ok: true });
  });
}
