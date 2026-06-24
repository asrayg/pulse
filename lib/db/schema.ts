import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());
const now = () => text("created_at").$defaultFn(() => new Date().toISOString());

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const workspaces = sqliteTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdByUserId: text("created_by_user_id"),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const workspaceMembers = sqliteTable("workspace_members", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("owner"), // owner | admin | analyst | viewer
  createdAt: now(),
});

export const dataSources = sqliteTable("data_sources", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // postgres | mysql | sqlite | csv | demo
  encryptedConfig: text("encrypted_config"), // JSON, encrypted at rest
  status: text("status").default("connected"),
  lastConnectedAt: text("last_connected_at"),
  lastIntrospectedAt: text("last_introspected_at"),
  createdByUserId: text("created_by_user_id"),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const dataSourceTables = sqliteTable("data_source_tables", {
  id: id(),
  dataSourceId: text("data_source_id").notNull(),
  tableName: text("table_name").notNull(),
  schemaName: text("schema_name"),
  rowCountEstimate: integer("row_count_estimate"),
  description: text("description"),
  createdAt: now(),
});

export const dataSourceColumns = sqliteTable("data_source_columns", {
  id: id(),
  tableId: text("table_id").notNull(),
  columnName: text("column_name").notNull(),
  dataType: text("data_type"),
  nullable: integer("nullable", { mode: "boolean" }).default(true),
  sampleValuesJson: text("sample_values_json"),
  description: text("description"),
  semanticType: text("semantic_type"),
  createdAt: now(),
});

export const relationships = sqliteTable("relationships", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  dataSourceId: text("data_source_id").notNull(),
  fromTable: text("from_table").notNull(),
  fromColumn: text("from_column").notNull(),
  toTable: text("to_table").notNull(),
  toColumn: text("to_column").notNull(),
  relationshipType: text("relationship_type").default("many_to_one"),
  confidence: real("confidence").default(0.5),
  createdAt: now(),
});

export const metrics = sqliteTable("metrics", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  sqlExpression: text("sql_expression").notNull(),
  baseTable: text("base_table"),
  synonymsJson: text("synonyms_json").default("[]"),
  ownerUserId: text("owner_user_id"),
  verified: integer("verified", { mode: "boolean" }).default(false),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const dimensions = sqliteTable("dimensions", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  tableName: text("table_name").notNull(),
  columnName: text("column_name").notNull(),
  synonymsJson: text("synonyms_json").default("[]"),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const savedQuestions = sqliteTable("saved_questions", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  title: text("title").notNull(),
  questionText: text("question_text").notNull(),
  generatedSql: text("generated_sql"),
  chartConfigJson: text("chart_config_json"),
  explanation: text("explanation"),
  answerJson: text("answer_json"),
  dataSourceId: text("data_source_id"),
  createdByUserId: text("created_by_user_id"),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const dashboards = sqliteTable("dashboards", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  summary: text("summary"),
  createdByUserId: text("created_by_user_id"),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const dashboardTiles = sqliteTable("dashboard_tiles", {
  id: id(),
  dashboardId: text("dashboard_id").notNull(),
  savedQuestionId: text("saved_question_id"),
  tileType: text("tile_type").notNull().default("chart"), // kpi | chart | table | text | anomaly
  title: text("title").notNull(),
  layoutJson: text("layout_json"),
  chartConfigJson: text("chart_config_json"),
  generatedSql: text("generated_sql"),
  dataSourceId: text("data_source_id"),
  explanation: text("explanation"),
  position: integer("position").default(0),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const queryRuns = sqliteTable("query_runs", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  dataSourceId: text("data_source_id"),
  userId: text("user_id"),
  questionText: text("question_text").notNull(),
  generatedSql: text("generated_sql"),
  status: text("status").notNull().default("success"), // success | error
  errorMessage: text("error_message"),
  resultPreviewJson: text("result_preview_json"),
  rowCount: integer("row_count"),
  executionTimeMs: integer("execution_time_ms"),
  confidence: text("confidence"),
  assumptionsJson: text("assumptions_json"),
  intent: text("intent"),
  createdAt: now(),
});

export const alerts = sqliteTable("alerts", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  dataSourceId: text("data_source_id"),
  generatedSql: text("generated_sql"),
  conditionJson: text("condition_json"),
  scheduleCron: text("schedule_cron"),
  notificationTarget: text("notification_target"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  lastCheckedAt: text("last_checked_at"),
  lastStatus: text("last_status"),
  createdByUserId: text("created_by_user_id"),
  createdAt: now(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const uploadedFiles = sqliteTable("uploaded_files", {
  id: id(),
  workspaceId: text("workspace_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  storageUrl: text("storage_url"),
  parsedTableName: text("parsed_table_name"),
  dataSourceId: text("data_source_id"),
  uploadedByUserId: text("uploaded_by_user_id"),
  createdAt: now(),
});

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type DataSource = typeof dataSources.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type Dimension = typeof dimensions.$inferSelect;
export type SavedQuestion = typeof savedQuestions.$inferSelect;
export type Dashboard = typeof dashboards.$inferSelect;
export type DashboardTile = typeof dashboardTiles.$inferSelect;
export type QueryRun = typeof queryRuns.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type UploadedFile = typeof uploadedFiles.$inferSelect;
