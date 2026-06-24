import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  return route(async () => {
    const ctx = await requireCtx();
    const rows = db
      .select()
      .from(schema.dashboards)
      .where(eq(schema.dashboards.workspaceId, ctx.workspaceId))
      .orderBy(desc(schema.dashboards.updatedAt))
      .all();
    const withCounts = rows.map((d) => {
      const tiles = db.select().from(schema.dashboardTiles).where(eq(schema.dashboardTiles.dashboardId, d.id)).all();
      return { ...d, tileCount: tiles.length };
    });
    return json({ dashboards: withCounts });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const { title, description } = await req.json();
    if (!title) return fail("Dashboard title is required.");
    const dash = db
      .insert(schema.dashboards)
      .values({ workspaceId: ctx.workspaceId, title, description: description ?? null, createdByUserId: ctx.user.id })
      .returning()
      .get();
    return json({ dashboard: dash });
  });
}
