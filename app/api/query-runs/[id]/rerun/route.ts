import { requireCtx, json, route, fail, defaultDataSource } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { ask } from "@/lib/agent/pipeline";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const run = db
      .select()
      .from(schema.queryRuns)
      .where(and(eq(schema.queryRuns.id, id), eq(schema.queryRuns.workspaceId, ctx.workspaceId)))
      .get();
    if (!run) return fail("Query run not found.", 404);

    const dataSourceId = run.dataSourceId ?? defaultDataSource(ctx.workspaceId)?.id;
    if (!dataSourceId) return fail("No data source available to re-run this question.", 400);

    const answer = await ask({
      question: run.questionText,
      workspaceId: ctx.workspaceId,
      dataSourceId,
      userId: ctx.user.id,
      persist: true,
    });
    return json({ answer });
  });
}
