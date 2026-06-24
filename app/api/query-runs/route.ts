import { requireCtx, json, route } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const limitParam = new URL(req.url).searchParams.get("limit");
    let limit = 100;
    if (limitParam) {
      const parsed = Number.parseInt(limitParam, 10);
      if (Number.isFinite(parsed) && parsed > 0) limit = Math.min(parsed, 500);
    }
    const queryRuns = db
      .select()
      .from(schema.queryRuns)
      .where(eq(schema.queryRuns.workspaceId, ctx.workspaceId))
      .orderBy(desc(schema.queryRuns.createdAt))
      .limit(limit)
      .all();
    return json({ queryRuns });
  });
}
