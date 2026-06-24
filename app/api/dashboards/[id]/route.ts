import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq, asc } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const dash = db
      .select()
      .from(schema.dashboards)
      .where(and(eq(schema.dashboards.id, id), eq(schema.dashboards.workspaceId, ctx.workspaceId)))
      .get();
    if (!dash) return fail("Dashboard not found.", 404);
    const tiles = db
      .select()
      .from(schema.dashboardTiles)
      .where(eq(schema.dashboardTiles.dashboardId, id))
      .orderBy(asc(schema.dashboardTiles.position))
      .all();
    return json({ dashboard: dash, tiles });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const dash = db
      .select()
      .from(schema.dashboards)
      .where(and(eq(schema.dashboards.id, id), eq(schema.dashboards.workspaceId, ctx.workspaceId)))
      .get();
    if (!dash) return fail("Dashboard not found.", 404);
    db.delete(schema.dashboardTiles).where(eq(schema.dashboardTiles.dashboardId, id)).run();
    db.delete(schema.dashboards).where(eq(schema.dashboards.id, id)).run();
    return json({ ok: true });
  });
}
