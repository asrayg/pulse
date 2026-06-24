import { redirect } from "next/navigation";
import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { HistoryIndex, type HistoryRun } from "@/components/history/history-index";

export default async function HistoryPage() {
  const ctx = await getCtx();
  if (!ctx?.workspaceId) redirect("/login");

  const rows = db
    .select()
    .from(schema.queryRuns)
    .where(eq(schema.queryRuns.workspaceId, ctx.workspaceId))
    .orderBy(desc(schema.queryRuns.createdAt))
    .limit(100)
    .all();

  const runs: HistoryRun[] = rows.map((r) => ({
    id: r.id,
    questionText: r.questionText,
    generatedSql: r.generatedSql ?? null,
    status: r.status ?? null,
    errorMessage: r.errorMessage ?? null,
    rowCount: r.rowCount ?? null,
    executionTimeMs: r.executionTimeMs ?? null,
    confidence: r.confidence ?? null,
    intent: r.intent ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    resultPreviewJson: r.resultPreviewJson ?? null,
    assumptionsJson: r.assumptionsJson ?? null,
  }));

  return <HistoryIndex runs={runs} />;
}
