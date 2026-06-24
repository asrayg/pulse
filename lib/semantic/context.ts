import "server-only";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SemanticContext, DataSourceSchema } from "@/lib/types";

/** Load the workspace semantic layer (metrics + dimensions) for agent context. */
export function loadSemanticContext(workspaceId: string): SemanticContext {
  const metricRows = db.select().from(schema.metrics).where(eq(schema.metrics.workspaceId, workspaceId)).all();
  const dimRows = db.select().from(schema.dimensions).where(eq(schema.dimensions.workspaceId, workspaceId)).all();

  return {
    metrics: metricRows.map((m) => ({
      name: m.name,
      displayName: m.displayName,
      description: m.description,
      sqlExpression: m.sqlExpression,
      baseTable: m.baseTable,
      synonyms: safeArr(m.synonymsJson),
      verified: !!m.verified,
    })),
    dimensions: dimRows.map((d) => ({
      name: d.name,
      displayName: d.displayName,
      description: d.description,
      table: d.tableName,
      column: d.columnName,
      synonyms: safeArr(d.synonymsJson),
    })),
  };
}

function safeArr(json: string | null): string[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** Render schema + semantic layer into a compact prompt block for the LLM. */
export function renderContextForPrompt(schemaData: DataSourceSchema, semantic: SemanticContext, dialect: string): string {
  const tableLines = schemaData.tables
    .map((t) => {
      const cols = t.columns
        .map((c) => `${c.name} ${c.dataType}${c.semanticType ? ` /*${c.semanticType}*/` : ""}`)
        .join(", ");
      return `- ${t.name} (${t.rowCountEstimate ?? "?"} rows): ${cols}`;
    })
    .join("\n");

  const rels =
    schemaData.relationships && schemaData.relationships.length
      ? "\nLIKELY RELATIONSHIPS:\n" +
        schemaData.relationships.map((r) => `- ${r.fromTable}.${r.fromColumn} → ${r.toTable}.${r.toColumn}`).join("\n")
      : "";

  const metrics = semantic.metrics.length
    ? "\nBUSINESS METRICS (prefer these definitions):\n" +
      semantic.metrics
        .map((m) => `- ${m.name} (${m.synonyms.join(", ")}): ${m.sqlExpression}${m.description ? ` — ${m.description}` : ""}`)
        .join("\n")
    : "";

  const dims = semantic.dimensions.length
    ? "\nDIMENSIONS:\n" +
      semantic.dimensions.map((d) => `- ${d.name} (${d.synonyms.join(", ")}) = ${d.table}.${d.column}`).join("\n")
    : "";

  return `SQL DIALECT: ${dialect}\nTABLES:\n${tableLines}${rels}${metrics}${dims}\nToday's date is ${new Date()
    .toISOString()
    .slice(0, 10)}.`;
}
