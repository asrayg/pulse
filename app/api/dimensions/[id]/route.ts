import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const existing = db
      .select()
      .from(schema.dimensions)
      .where(and(eq(schema.dimensions.id, id), eq(schema.dimensions.workspaceId, ctx.workspaceId)))
      .get();
    if (!existing) return fail("Dimension not found.", 404);

    const body = await req.json();
    const updates: Partial<typeof schema.dimensions.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.displayName === "string") updates.displayName = body.displayName;
    if (body.description !== undefined) updates.description = body.description ?? null;
    if (typeof body.tableName === "string") updates.tableName = body.tableName;
    if (typeof body.columnName === "string") updates.columnName = body.columnName;
    if (body.synonyms !== undefined) updates.synonymsJson = JSON.stringify(Array.isArray(body.synonyms) ? body.synonyms : []);

    const dimension = db
      .update(schema.dimensions)
      .set(updates)
      .where(and(eq(schema.dimensions.id, id), eq(schema.dimensions.workspaceId, ctx.workspaceId)))
      .returning()
      .get();
    return json({ dimension });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const existing = db
      .select()
      .from(schema.dimensions)
      .where(and(eq(schema.dimensions.id, id), eq(schema.dimensions.workspaceId, ctx.workspaceId)))
      .get();
    if (!existing) return fail("Dimension not found.", 404);
    db.delete(schema.dimensions).where(eq(schema.dimensions.id, id)).run();
    return json({ ok: true });
  });
}
