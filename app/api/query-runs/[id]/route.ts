import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const run = db
      .select()
      .from(schema.queryRuns)
      .where(and(eq(schema.queryRuns.id, id), eq(schema.queryRuns.workspaceId, ctx.workspaceId)))
      .get();
    if (!run) return fail("Query run not found.", 404);

    const resultPreview = parseJson<unknown>(run.resultPreviewJson, null);
    const assumptions = parseJson<string[]>(run.assumptionsJson, []);
    return json({ run, resultPreview, assumptions });
  });
}
