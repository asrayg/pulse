import { requireCtx, fail, json, route, defaultDataSource, getDataSource } from "@/lib/api";
import { ask } from "@/lib/agent/pipeline";

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const body = await req.json();
    const question = (body.question ?? "").toString().trim();
    if (!question) return fail("Ask a question to get started.");

    const ds = body.dataSourceId
      ? getDataSource(ctx.workspaceId, body.dataSourceId)
      : defaultDataSource(ctx.workspaceId);
    if (!ds) return fail("Connect a database or upload a CSV to start.", 400);

    const answer = await ask({
      question,
      workspaceId: ctx.workspaceId,
      dataSourceId: ds.id,
      userId: ctx.user.id,
      persist: body.persist !== false,
    });
    return json({ answer });
  });
}
