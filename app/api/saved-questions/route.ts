import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  return route(async () => {
    const ctx = await requireCtx();
    const rows = db
      .select()
      .from(schema.savedQuestions)
      .where(eq(schema.savedQuestions.workspaceId, ctx.workspaceId))
      .orderBy(desc(schema.savedQuestions.updatedAt))
      .all();
    return json({ savedQuestions: rows });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const { title, questionText, generatedSql, chartConfig, explanation, answer, dataSourceId } = await req.json();
    if (!title || !questionText) return fail("Title and question are required.");
    const sq = db
      .insert(schema.savedQuestions)
      .values({
        workspaceId: ctx.workspaceId,
        title,
        questionText,
        generatedSql: generatedSql ?? null,
        chartConfigJson: chartConfig ? JSON.stringify(chartConfig) : null,
        explanation: explanation ?? null,
        answerJson: answer ? JSON.stringify(answer) : null,
        dataSourceId: dataSourceId ?? null,
        createdByUserId: ctx.user.id,
      })
      .returning()
      .get();
    return json({ savedQuestion: sq });
  });
}
