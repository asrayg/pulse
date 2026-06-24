import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  return route(async () => {
    const ctx = await requireCtx();
    const rows = db
      .select()
      .from(schema.dimensions)
      .where(eq(schema.dimensions.workspaceId, ctx.workspaceId))
      .orderBy(desc(schema.dimensions.createdAt))
      .all();
    return json({ dimensions: rows });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const { name, displayName, description, tableName, columnName, synonyms } = await req.json();
    if (!name || typeof name !== "string") return fail("Dimension name is required.");
    if (!displayName || typeof displayName !== "string") return fail("Display name is required.");
    if (!tableName || typeof tableName !== "string") return fail("A table is required.");
    if (!columnName || typeof columnName !== "string") return fail("A column is required.");
    const dimension = db
      .insert(schema.dimensions)
      .values({
        workspaceId: ctx.workspaceId,
        name,
        displayName,
        description: description ?? null,
        tableName,
        columnName,
        synonymsJson: JSON.stringify(Array.isArray(synonyms) ? synonyms : []),
      })
      .returning()
      .get();
    return json({ dimension });
  });
}
