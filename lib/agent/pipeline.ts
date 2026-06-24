import "server-only";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAdapter } from "@/lib/adapters";
import { validateSql } from "@/lib/sql/safety";
import { loadSemanticContext, renderContextForPrompt } from "@/lib/semantic/context";
import { recommendChart, reconcileChart } from "@/lib/charts/recommend";
import { inspectResult } from "./inspect";
import { planFallback } from "./fallback";
import { hasLLM, llmObject, llmText } from "./llm";
import { SQL_GEN_SYSTEM, AGENT_SYSTEM_PROMPT } from "./prompt";
import type { AgentAnswer, AgentStep, ChartConfig, QueryResult } from "@/lib/types";

const SqlPlanSchema = z.object({
  intent: z.enum([
    "simple_metric", "comparison", "trend", "segmentation", "root_cause",
    "dashboard_creation", "alert_creation", "data_dictionary_question", "csv_analysis", "general_help",
  ]),
  sql: z.string().describe("A single read-only SELECT/WITH query."),
  chart: z.object({
    type: z.enum(["line", "bar", "horizontal_bar", "area", "stacked_bar", "pie", "donut", "scatter", "kpi", "table"]),
    title: z.string(),
    x: z.string().optional(),
    y: z.union([z.string(), z.array(z.string())]).optional(),
    series: z.string().optional(),
    valueField: z.string().optional(),
    format: z.enum(["number", "currency", "percent", "date"]).optional(),
  }),
  assumptions: z.array(z.string()),
  followUps: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});

export interface AskInput {
  question: string;
  workspaceId: string;
  dataSourceId: string;
  userId?: string;
  persist?: boolean;
}

export async function ask(input: AskInput): Promise<AgentAnswer> {
  const trace: AgentStep[] = [];
  const t0 = Date.now();
  const step = (s: string, status: AgentStep["status"], detail?: string, start?: number) =>
    trace.push({ step: s, status, detail, durationMs: start ? Date.now() - start : undefined });

  const ds = db.select().from(schema.dataSources).where(eq(schema.dataSources.id, input.dataSourceId)).get();
  if (!ds) return errorAnswer(input.question, "Data source not found. Connect a database or upload a CSV to start.");

  let adapter;
  try {
    adapter = getAdapter(ds);
  } catch (e) {
    return errorAnswer(input.question, (e as Error).message);
  }

  // Step 2: schema + semantic context
  const sIntro = Date.now();
  let schemaData;
  try {
    schemaData = await adapter.introspect();
    step("Inspect schema", "ok", `${schemaData.tables.length} tables`, sIntro);
  } catch (e) {
    return errorAnswer(input.question, `Could not read schema: ${(e as Error).message}`);
  }
  const tableNames = schemaData.tables.map((t) => t.name);
  const semantic = loadSemanticContext(input.workspaceId);

  let answer: AgentAnswer;
  if (hasLLM()) {
    answer = await runLLM(input, adapter, schemaData, semantic, tableNames, trace, step);
  } else {
    answer = await runFallback(input, adapter, tableNames, trace, step);
  }

  answer.trace = trace;
  answer.dataSourceId = ds.id;

  // Step 9 (persist)
  if (input.persist !== false) {
    try {
      db.insert(schema.queryRuns)
        .values({
          workspaceId: input.workspaceId,
          dataSourceId: ds.id,
          userId: input.userId,
          questionText: input.question,
          generatedSql: answer.sql,
          status: answer.error ? "error" : "success",
          errorMessage: answer.error ?? null,
          resultPreviewJson: answer.result ? JSON.stringify({ columns: answer.result.columns, rows: answer.result.rows.slice(0, 20) }) : null,
          rowCount: answer.result?.rowCount ?? null,
          executionTimeMs: answer.result?.executionTimeMs ?? Date.now() - t0,
          confidence: answer.confidence,
          assumptionsJson: JSON.stringify(answer.assumptions),
          intent: answer.intent,
        })
        .run();
    } catch (e) {
      console.error("[pulse] failed to persist query run:", (e as Error).message);
    }
  }

  return answer;
}

// ---- LLM path ---------------------------------------------------------------
async function runLLM(
  input: AskInput,
  adapter: ReturnType<typeof getAdapter>,
  schemaData: Awaited<ReturnType<typeof adapter.introspect>>,
  semantic: ReturnType<typeof loadSemanticContext>,
  tableNames: string[],
  trace: AgentStep[],
  step: (s: string, status: AgentStep["status"], detail?: string, start?: number) => void,
): Promise<AgentAnswer> {
  const ctx = renderContextForPrompt(schemaData, semantic, adapter.dialect);
  const sPlan = Date.now();
  const plan = await llmObject({
    schema: SqlPlanSchema,
    system: SQL_GEN_SYSTEM,
    prompt: `${ctx}\n\nQUESTION: ${input.question}\n\nReturn the plan, SQL, and a chart spec whose x/y/valueField reference columns your SQL actually returns.`,
    temperature: 0.1,
  });
  if (!plan) {
    // LLM failed at runtime → degrade to fallback.
    step("Generate SQL", "warn", "LLM unavailable, using deterministic planner");
    return runFallback(input, adapter, tableNames, trace, step);
  }
  step("Generate SQL", "ok", plan.intent, sPlan);

  // Validate (+ one repair attempt)
  let validation = validateSql(plan.sql, { knownTables: tableNames, dialect: adapter.dialect });
  let sql = validation.safeSql;
  if (!validation.ok) {
    step("Validate SQL", "warn", validation.errors.join("; "));
    const repaired = await llmObject({
      schema: SqlPlanSchema,
      system: SQL_GEN_SYSTEM,
      prompt: `${ctx}\n\nQUESTION: ${input.question}\n\nYour previous SQL was rejected by the safety validator:\n${plan.sql}\n\nErrors: ${validation.errors.join("; ")}\n\nReturn a corrected, read-only query.`,
    });
    if (repaired) {
      validation = validateSql(repaired.sql, { knownTables: tableNames, dialect: adapter.dialect });
      sql = validation.safeSql;
      plan.chart = repaired.chart;
    }
    if (!validation.ok) {
      return { ...baseAnswer(input.question, plan.intent), error: `SQL failed safety validation: ${validation.errors.join("; ")}`, sql: plan.sql, assumptions: plan.assumptions, validation, confidence: "low", usedLLM: true };
    }
  } else {
    step("Validate SQL", "ok", validation.warnings.length ? `${validation.warnings.length} warnings` : "passed");
  }

  // Execute (+ one repair on error)
  let result: QueryResult | null = null;
  const sExec = Date.now();
  try {
    result = await adapter.run(sql);
    step("Execute SQL", "ok", `${result.rowCount} rows`, sExec);
  } catch (e) {
    step("Execute SQL", "error", (e as Error).message, sExec);
    const repaired = await llmObject({
      schema: SqlPlanSchema,
      system: SQL_GEN_SYSTEM,
      prompt: `${ctx}\n\nQUESTION: ${input.question}\n\nThis query errored: ${sql}\nError: ${(e as Error).message}\nReturn a corrected read-only query.`,
    });
    if (repaired) {
      const v2 = validateSql(repaired.sql, { knownTables: tableNames, dialect: adapter.dialect });
      if (v2.ok) {
        try {
          result = await adapter.run(v2.safeSql);
          sql = v2.safeSql;
          plan.chart = repaired.chart;
          step("Repair + re-execute", "ok", `${result.rowCount} rows`);
        } catch (e2) {
          return { ...baseAnswer(input.question, plan.intent), error: (e2 as Error).message, sql, assumptions: plan.assumptions, validation, confidence: "low", usedLLM: true };
        }
      }
    }
    if (!result) {
      return { ...baseAnswer(input.question, plan.intent), error: (e as Error).message, sql, assumptions: plan.assumptions, validation, confidence: "low", usedLLM: true };
    }
  }

  const inspection = inspectResult(result);
  if (inspection.notes.length) step("Validate result", inspection.suspicious ? "warn" : "ok", inspection.notes[0]);

  const chart = reconcileChart(plan.chart as ChartConfig, result, plan.chart.title);

  // Summarize grounded in real numbers
  const summary = await llmText({
    system: AGENT_SYSTEM_PROMPT,
    prompt: `Question: ${input.question}\n\nSQL result (first rows):\n${JSON.stringify({ columns: result.columns, rows: result.rows.slice(0, 30) })}\n\nWrite a 1-2 sentence direct answer, then a short business explanation (2-3 sentences). Be specific with the numbers. Format as:\nANSWER: ...\nEXPLANATION: ...`,
    temperature: 0.3,
  });
  const { answer: directAnswer, explanation } = parseSummary(summary, result, input.question);

  return {
    ...baseAnswer(input.question, plan.intent),
    answer: directAnswer,
    explanation,
    sql,
    chart,
    result,
    assumptions: plan.assumptions,
    confidence: inspection.suspicious ? "low" : plan.confidence,
    followUps: plan.followUps,
    validation,
    dataNotes: inspection.notes,
    usedLLM: true,
  };
}

// ---- Fallback path ----------------------------------------------------------
async function runFallback(
  input: AskInput,
  adapter: ReturnType<typeof getAdapter>,
  tableNames: string[],
  _trace: AgentStep[],
  step: (s: string, status: AgentStep["status"], detail?: string, start?: number) => void,
): Promise<AgentAnswer> {
  const plan = planFallback(input.question, tableNames);
  step("Plan (deterministic)", "ok", plan.intent);

  const runOne = async (sqlStr: string): Promise<QueryResult> => {
    const v = validateSql(sqlStr, { knownTables: tableNames, dialect: adapter.dialect });
    return adapter.run(v.safeSql);
  };

  let primary: QueryResult;
  const sExec = Date.now();
  try {
    primary = await runOne(plan.primary.sql);
    step("Execute SQL", "ok", `${primary.rowCount} rows`, sExec);
  } catch (e) {
    return { ...baseAnswer(input.question, plan.intent), error: (e as Error).message, sql: plan.primary.sql, assumptions: plan.assumptions, confidence: "low" };
  }

  const extraResults: QueryResult[] = [];
  for (const ex of plan.extras ?? []) {
    try {
      extraResults.push(await runOne(ex.sql));
    } catch {
      extraResults.push({ columns: [], rows: [], rowCount: 0, executionTimeMs: 0, truncated: false });
    }
  }

  const inspection = inspectResult(primary);
  const { answer, explanation, extras } = plan.summarize(primary, extraResults);
  const chart = reconcileChart(plan.primary.chart, primary, plan.primary.chart.title);
  const validation = validateSql(plan.primary.sql, { knownTables: tableNames, dialect: adapter.dialect });

  return {
    ...baseAnswer(input.question, plan.intent),
    answer,
    explanation,
    sql: validation.safeSql,
    chart,
    result: primary,
    assumptions: [...plan.assumptions, "Answered by the deterministic planner (no LLM key configured)."],
    confidence: inspection.suspicious ? "low" : "medium",
    followUps: plan.followUps,
    validation,
    dataNotes: inspection.notes,
    extras,
    usedLLM: false,
  };
}

// ---- helpers ----------------------------------------------------------------
function baseAnswer(question: string, intent: AgentAnswer["intent"]): AgentAnswer {
  return {
    question,
    intent,
    answer: "",
    assumptions: [],
    confidence: "medium",
    followUps: [],
    error: null,
  };
}

function errorAnswer(question: string, message: string): AgentAnswer {
  return { ...baseAnswer(question, "general_help"), answer: message, error: message, confidence: "low" };
}

function parseSummary(text: string | null, result: QueryResult, question: string): { answer: string; explanation?: string } {
  if (!text) {
    const rc = recommendChart(result, question);
    return { answer: result.rowCount ? `Returned ${result.rowCount} rows.` : "No rows matched this question.", explanation: rc.description };
  }
  const ansMatch = text.match(/ANSWER:\s*([\s\S]*?)(?:\nEXPLANATION:|$)/i);
  const expMatch = text.match(/EXPLANATION:\s*([\s\S]*)$/i);
  return {
    answer: ansMatch?.[1]?.trim() || text.trim().split("\n")[0],
    explanation: expMatch?.[1]?.trim(),
  };
}
