import "server-only";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { demoDbPath } from "@/lib/adapters";
import { SqliteAdapter } from "@/lib/adapters/sqlite";

/**
 * Provisions a brand-new workspace with the demo dataset, a starter semantic
 * layer, and a "Company Overview" dashboard — the first-run experience.
 */
export async function provisionDemoWorkspace(workspaceId: string, userId: string) {
  // Demo data source
  const ds = db
    .insert(schema.dataSources)
    .values({
      workspaceId,
      name: "Demo SaaS",
      type: "demo",
      status: "connected",
      lastConnectedAt: new Date().toISOString(),
      lastIntrospectedAt: new Date().toISOString(),
      createdByUserId: userId,
    })
    .returning()
    .get();

  // Persist schema for the schema browser
  try {
    const adapter = new SqliteAdapter(demoDbPath(), "demo");
    const introspected = await adapter.introspect();
    for (const t of introspected.tables) {
      const tableRow = db
        .insert(schema.dataSourceTables)
        .values({ dataSourceId: ds.id, tableName: t.name, rowCountEstimate: t.rowCountEstimate })
        .returning()
        .get();
      for (const c of t.columns) {
        db.insert(schema.dataSourceColumns)
          .values({
            tableId: tableRow.id,
            columnName: c.name,
            dataType: c.dataType,
            nullable: c.nullable,
            sampleValuesJson: JSON.stringify(c.sampleValues ?? []),
            semanticType: c.semanticType,
          })
          .run();
      }
    }
  } catch (e) {
    console.error("[pulse] onboarding introspect failed:", (e as Error).message);
  }

  // Semantic layer
  const metrics = [
    { name: "revenue", displayName: "Revenue", description: "Sum of paid invoice amounts.", sqlExpression: "SUM(amount) FILTER (WHERE status = 'paid')", baseTable: "invoices", synonyms: ["sales", "income"], verified: true },
    { name: "monthly_recurring_revenue", displayName: "Monthly Recurring Revenue", description: "Active subscription revenue per month.", sqlExpression: "SUM(monthly_amount) FILTER (WHERE status = 'active')", baseTable: "subscriptions", synonyms: ["MRR", "recurring revenue"], verified: true },
    { name: "active_user", displayName: "Active User", description: "User with ≥1 event in 30 days.", sqlExpression: "COUNT(DISTINCT user_id)", baseTable: "events", synonyms: ["active customer", "WAU", "MAU"], verified: true },
    { name: "churn", displayName: "Churn", description: "Canceled subscriptions.", sqlExpression: "COUNT(*) FILTER (WHERE status = 'canceled')", baseTable: "subscriptions", synonyms: ["cancellations"], verified: true },
  ];
  for (const m of metrics) {
    db.insert(schema.metrics).values({ workspaceId, name: m.name, displayName: m.displayName, description: m.description, sqlExpression: m.sqlExpression, baseTable: m.baseTable, synonymsJson: JSON.stringify(m.synonyms), ownerUserId: userId, verified: m.verified }).run();
  }
  const dims = [
    { name: "signup_channel", displayName: "Signup Channel", table: "customers", column: "channel", synonyms: ["source", "channel"] },
    { name: "plan", displayName: "Plan", table: "subscriptions", column: "plan", synonyms: ["tier"] },
    { name: "region", displayName: "Region", table: "customers", column: "region", synonyms: ["geo"] },
  ];
  for (const d of dims) {
    db.insert(schema.dimensions).values({ workspaceId, name: d.name, displayName: d.displayName, tableName: d.table, columnName: d.column, synonymsJson: JSON.stringify(d.synonyms) }).run();
  }

  // Starter dashboard
  const dash = db
    .insert(schema.dashboards)
    .values({ workspaceId, title: "Company Overview", description: "Auto-generated executive snapshot.", summary: "Revenue, growth, engagement, and support health at a glance.", createdByUserId: userId })
    .returning()
    .get();
  const tiles = [
    { tileType: "kpi", title: "Revenue (30d)", sql: "SELECT ROUND(SUM(amount),2) AS revenue FROM invoices WHERE status='paid' AND paid_at>=date('now','-30 days')", chart: { type: "kpi", title: "Revenue (30d)", valueField: "revenue", format: "currency" } },
    { tileType: "kpi", title: "Active Users (30d)", sql: "SELECT COUNT(DISTINCT user_id) AS active_users FROM events WHERE timestamp>=date('now','-30 days')", chart: { type: "kpi", title: "Active Users", valueField: "active_users", format: "number" } },
    { tileType: "kpi", title: "New Customers (30d)", sql: "SELECT COUNT(*) AS new_customers FROM customers WHERE created_at>=date('now','-30 days')", chart: { type: "kpi", title: "New Customers", valueField: "new_customers", format: "number" } },
    { tileType: "kpi", title: "Churned Subs (30d)", sql: "SELECT COUNT(*) AS churned FROM subscriptions WHERE status='canceled' AND canceled_at>=date('now','-30 days')", chart: { type: "kpi", title: "Churned", valueField: "churned", format: "number" } },
    { tileType: "chart", title: "Weekly Revenue", sql: "SELECT strftime('%Y-W%W', paid_at) AS week, ROUND(SUM(amount),2) AS revenue FROM invoices WHERE status='paid' AND paid_at>=date('now','-84 days') GROUP BY week ORDER BY week", chart: { type: "area", title: "Weekly Revenue", x: "week", y: "revenue", format: "currency" } },
    { tileType: "chart", title: "Revenue by Plan", sql: "SELECT plan, ROUND(SUM(amount),2) AS revenue FROM invoices WHERE status='paid' AND paid_at>=date('now','-30 days') GROUP BY plan ORDER BY revenue DESC", chart: { type: "bar", title: "Revenue by Plan", x: "plan", y: "revenue", format: "currency" } },
    { tileType: "chart", title: "Top Customers", sql: "SELECT c.name AS customer, ROUND(SUM(i.amount),2) AS revenue FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.status='paid' AND i.paid_at>=date('now','-30 days') GROUP BY c.id ORDER BY revenue DESC LIMIT 8", chart: { type: "horizontal_bar", title: "Top Customers", x: "customer", y: "revenue", format: "currency" } },
    { tileType: "chart", title: "Daily Support Tickets", sql: "SELECT date(created_at) AS day, COUNT(*) AS tickets FROM support_tickets WHERE created_at>=date('now','-30 days') GROUP BY day ORDER BY day", chart: { type: "line", title: "Daily Support Tickets", x: "day", y: "tickets" } },
  ];
  tiles.forEach((t, i) =>
    db.insert(schema.dashboardTiles).values({ dashboardId: dash.id, tileType: t.tileType, title: t.title, generatedSql: t.sql, chartConfigJson: JSON.stringify(t.chart), dataSourceId: ds.id, position: i }).run(),
  );

  return ds;
}

export function workspaceHasDemo(workspaceId: string) {
  return db.select().from(schema.dataSources).where(eq(schema.dataSources.workspaceId, workspaceId)).all().some((d) => d.type === "demo");
}
