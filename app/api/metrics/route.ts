import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  return route(async () => {
    const ctx = await requireCtx();
    const rows = db
      .select()
      .from(schema.metrics)
      .where(eq(schema.metrics.workspaceId, ctx.workspaceId))
      .orderBy(desc(schema.metrics.createdAt))
      .all();
    return json({ metrics: rows });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const { name, displayName, description, sqlExpression, baseTable, synonyms, verified } = await req.json();
    if (!name || typeof name !== "string") return fail("Metric name is required.");
    if (!displayName || typeof displayName !== "string") return fail("Display name is required.");
    if (!sqlExpression || typeof sqlExpression !== "string") return fail("A SQL expression is required.");
    const metric = db
      .insert(schema.metrics)
      .values({
        workspaceId: ctx.workspaceId,
        name,
        displayName,
        description: description ?? null,
        sqlExpression,
        baseTable: baseTable ?? null,
        synonymsJson: JSON.stringify(Array.isArray(synonyms) ? synonyms : []),
        ownerUserId: ctx.user.id,
        verified: Boolean(verified),
      })
      .returning()
      .get();
    return json({ metric });
  });
}
