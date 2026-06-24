import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const dash = db
      .select()
      .from(schema.dashboards)
      .where(and(eq(schema.dashboards.id, id), eq(schema.dashboards.workspaceId, ctx.workspaceId)))
      .get();
    if (!dash) return fail("Dashboard not found.", 404);

    const { title, tileType, generatedSql, chartConfig, dataSourceId, savedQuestionId, explanation } = await req.json();
    if (!title) return fail("Tile title is required.");

    const existing = db.select().from(schema.dashboardTiles).where(eq(schema.dashboardTiles.dashboardId, id)).all();
    const tile = db
      .insert(schema.dashboardTiles)
      .values({
        dashboardId: id,
        title,
        tileType: tileType ?? "chart",
        generatedSql: generatedSql ?? null,
        chartConfigJson: chartConfig ? JSON.stringify(chartConfig) : null,
        dataSourceId: dataSourceId ?? null,
        savedQuestionId: savedQuestionId ?? null,
        explanation: explanation ?? null,
        position: existing.length,
      })
      .returning()
      .get();
    db.update(schema.dashboards).set({ updatedAt: new Date().toISOString() }).where(eq(schema.dashboards.id, id)).run();
    return json({ tile });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    await requireCtx();
    const { id } = await params;
    const url = new URL(req.url);
    const tileId = url.searchParams.get("tileId");
    if (!tileId) return fail("Missing tileId.");
    db.delete(schema.dashboardTiles).where(and(eq(schema.dashboardTiles.id, tileId), eq(schema.dashboardTiles.dashboardId, id))).run();
    return json({ ok: true });
  });
}
