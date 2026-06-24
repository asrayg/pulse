/* ============================================================================
   Pulse shared types — the cross-cutting contract used by the agent pipeline,
   API routes, and UI. Keep this in sync; everything imports from here.
============================================================================ */

export type ChartType =
  | "line"
  | "bar"
  | "horizontal_bar"
  | "area"
  | "stacked_bar"
  | "pie"
  | "donut"
  | "scatter"
  | "kpi"
  | "table";

export interface ChartConfig {
  type: ChartType;
  title: string;
  /** field name on each row used for the x axis / category / label */
  x?: string;
  /** field name(s) used for the y axis / value */
  y?: string | string[];
  /** optional field to split into multiple series */
  series?: string;
  /** value format hint */
  format?: "number" | "currency" | "percent" | "date";
  description?: string;
  /** for kpi cards */
  valueField?: string;
  /** optional secondary kpi: previous period / delta */
  deltaField?: string;
}

export type SqlRow = Record<string, string | number | boolean | null>;

export interface QueryResult {
  columns: string[];
  rows: SqlRow[];
  rowCount: number;
  executionTimeMs: number;
  truncated: boolean;
}

export interface SqlValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** normalized/cleaned sql that is safe to run (LIMIT injected etc.) */
  safeSql: string;
}

export type IntentType =
  | "simple_metric"
  | "comparison"
  | "trend"
  | "segmentation"
  | "root_cause"
  | "dashboard_creation"
  | "alert_creation"
  | "data_dictionary_question"
  | "csv_analysis"
  | "general_help";

export interface AnalysisPlan {
  goal: string;
  intent: IntentType;
  required_tables: string[];
  metrics: string[];
  comparisons?: string[];
  segments_to_check?: string[];
  expected_output: string[];
}

export type Confidence = "high" | "medium" | "low";

/** The canonical answer object every agent question returns. */
export interface AgentAnswer {
  question: string;
  intent: IntentType;
  /** one or two sentence direct answer */
  answer: string;
  /** longer business narrative / explanation */
  explanation?: string;
  sql?: string;
  chart?: ChartConfig | null;
  result?: QueryResult | null;
  assumptions: string[];
  confidence: Confidence;
  followUps: string[];
  /** validation findings surfaced to the right panel */
  validation?: SqlValidation | null;
  /** non-fatal data-quality notes from result inspection */
  dataNotes?: string[];
  /** step-by-step trace for the transparency panel */
  trace?: AgentStep[];
  error?: string | null;
  /** which data source answered */
  dataSourceId?: string;
  /** secondary panels for richer answers (root-cause segments etc.) */
  extras?: AnswerExtra[];
  usedLLM?: boolean;
}

export interface AnswerExtra {
  kind: "segment_table" | "kpi_grid" | "note";
  title: string;
  chart?: ChartConfig | null;
  result?: QueryResult | null;
  text?: string;
}

export interface AgentStep {
  step: string;
  status: "ok" | "warn" | "error";
  detail?: string;
  durationMs?: number;
}

export type DataSourceType = "postgres" | "mysql" | "sqlite" | "csv" | "demo";

export interface SchemaColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  semanticType?: SemanticType;
  sampleValues?: (string | number | null)[];
  description?: string;
}

export interface SchemaTable {
  name: string;
  schema?: string;
  rowCountEstimate?: number;
  description?: string;
  columns: SchemaColumn[];
}

export interface DataSourceSchema {
  tables: SchemaTable[];
  relationships?: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; confidence: number }[];
}

export type SemanticType =
  | "currency"
  | "date"
  | "email"
  | "id"
  | "category"
  | "percentage"
  | "boolean"
  | "text"
  | "number";

/** A database adapter executes read-only SQL and introspects schema. */
export interface DbAdapter {
  type: DataSourceType;
  introspect(): Promise<DataSourceSchema>;
  run(sql: string, opts?: { maxRows?: number; timeoutMs?: number }): Promise<QueryResult>;
  /** quoting/identifier dialect hint passed to the SQL generator */
  dialect: "sqlite" | "postgres" | "mysql";
  test(): Promise<{ ok: boolean; message: string }>;
  close?(): void;
}

export interface SemanticContext {
  metrics: {
    name: string;
    displayName: string;
    description?: string | null;
    sqlExpression: string;
    baseTable?: string | null;
    synonyms: string[];
    verified: boolean;
  }[];
  dimensions: {
    name: string;
    displayName: string;
    description?: string | null;
    table: string;
    column: string;
    synonyms: string[];
  }[];
}

export type Role = "owner" | "admin" | "analyst" | "viewer";
