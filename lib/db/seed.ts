/**
 * Seeds the Pulse app database (data/pulse.db) with:
 *  - a demo user (demo@pulse.app / demo1234)
 *  - a workspace ("Acme Inc")
 *  - a "Demo SaaS" data source (points at data/demo.db) + stored schema
 *  - a starter semantic layer (metrics + dimensions)
 *  - a "Company Overview" starter dashboard
 *
 * Self-contained (own DB connections) so it runs cleanly under tsx.
 * Run: pnpm seed:app   (after pnpm db:push && pnpm seed:demo)
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import { inferSemanticType } from "../adapters/infer";

const DB_PATH = process.env.PULSE_DB_PATH ?? path.join(process.cwd(), "data", "pulse.db");
const DEMO_PATH = process.env.PULSE_DEMO_DB_PATH ?? path.join(process.cwd(), "data", "demo.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite, { schema });

async function main() {
  // 1. user
  const email = "demo@pulse.app";
  let user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user) {
    const hash = await bcrypt.hash("demo1234", 10);
    user = db.insert(schema.users).values({ email, name: "Demo Operator", passwordHash: hash }).returning().get();
    console.log("✓ created demo user", email, "/ demo1234");
  } else {
    console.log("• demo user exists");
  }

  // 2. workspace
  let ws = db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, "acme")).get();
  if (!ws) {
    ws = db.insert(schema.workspaces).values({ name: "Acme Inc", slug: "acme", createdByUserId: user.id }).returning().get();
    db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: user.id, role: "owner" }).run();
    console.log("✓ created workspace Acme Inc");
  } else {
    console.log("• workspace exists");
  }

  // 3. demo data source
  let ds = db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.workspaceId, ws.id))
    .all()
    .find((d) => d.type === "demo");
  if (!ds) {
    ds = db
      .insert(schema.dataSources)
      .values({
        workspaceId: ws.id,
        name: "Demo SaaS",
        type: "demo",
        status: "connected",
        lastConnectedAt: new Date().toISOString(),
        lastIntrospectedAt: new Date().toISOString(),
        createdByUserId: user.id,
      })
      .returning()
      .get();
    console.log("✓ created Demo SaaS data source");
  } else {
    console.log("• demo data source exists");
  }

  // 4. introspect demo.db → store tables/columns
  if (fs.existsSync(DEMO_PATH)) {
    db.delete(schema.dataSourceColumns).run(); // simple reset for the demo source schema
    db.delete(schema.dataSourceTables).where(eq(schema.dataSourceTables.dataSourceId, ds.id)).run();
    const demo = new Database(DEMO_PATH, { readonly: true });
    const tables = demo.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
    for (const { name } of tables) {
      const cnt = (demo.prepare(`SELECT COUNT(*) c FROM "${name}"`).get() as { c: number }).c;
      const tableRow = db.insert(schema.dataSourceTables).values({ dataSourceId: ds.id, tableName: name, rowCountEstimate: cnt }).returning().get();
      const cols = demo.prepare(`PRAGMA table_info("${name}")`).all() as { name: string; type: string; notnull: number }[];
      const samples = demo.prepare(`SELECT * FROM "${name}" LIMIT 12`).all() as Record<string, unknown>[];
      for (const c of cols) {
        const sv = samples.map((r) => r[c.name] as string | number | null).filter((v) => v !== undefined).slice(0, 8);
        db.insert(schema.dataSourceColumns)
          .values({
            tableId: tableRow.id,
            columnName: c.name,
            dataType: c.type || "TEXT",
            nullable: c.notnull === 0,
            sampleValuesJson: JSON.stringify(sv),
            semanticType: inferSemanticType(c.name, c.type, sv),
          })
          .run();
      }
    }
    demo.close();
    console.log(`✓ stored schema for ${tables.length} demo tables`);
  } else {
    console.warn("! demo.db not found — run `pnpm seed:demo` first");
  }

  // 5. semantic layer
  const existingMetrics = db.select().from(schema.metrics).where(eq(schema.metrics.workspaceId, ws.id)).all();
  if (existingMetrics.length === 0) {
    const M = [
      { name: "monthly_recurring_revenue", displayName: "Monthly Recurring Revenue", description: "Total active subscription revenue per month, excluding canceled.", sqlExpression: "SUM(monthly_amount) FILTER (WHERE status = 'active')", baseTable: "subscriptions", synonyms: ["MRR", "recurring revenue", "monthly revenue"], verified: true },
      { name: "revenue", displayName: "Revenue", description: "Sum of paid invoice amounts.", sqlExpression: "SUM(amount) FILTER (WHERE status = 'paid')", baseTable: "invoices", synonyms: ["sales", "income", "paid revenue"], verified: true },
      { name: "active_user", displayName: "Active User", description: "A user with at least one event in the last 30 days.", sqlExpression: "COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= date('now','-30 days'))", baseTable: "events", synonyms: ["active customer", "engaged user", "WAU", "MAU"], verified: true },
      { name: "churn", displayName: "Churn", description: "Subscriptions canceled and not renewed.", sqlExpression: "COUNT(*) FILTER (WHERE status = 'canceled')", baseTable: "subscriptions", synonyms: ["cancellations", "lost customers"], verified: true },
      { name: "new_customers", displayName: "New Customers", description: "Customers created in the period.", sqlExpression: "COUNT(*)", baseTable: "customers", synonyms: ["signups", "acquisitions"], verified: false },
    ];
    for (const m of M) {
      db.insert(schema.metrics).values({ workspaceId: ws.id, name: m.name, displayName: m.displayName, description: m.description, sqlExpression: m.sqlExpression, baseTable: m.baseTable, synonymsJson: JSON.stringify(m.synonyms), ownerUserId: user.id, verified: m.verified }).run();
    }
    const D = [
      { name: "signup_channel", displayName: "Signup Channel", table: "customers", column: "channel", synonyms: ["source", "acquisition source", "channel"] },
      { name: "plan", displayName: "Plan", table: "subscriptions", column: "plan", synonyms: ["tier", "package"] },
      { name: "region", displayName: "Region", table: "customers", column: "region", synonyms: ["geo", "geography"] },
      { name: "industry", displayName: "Industry", table: "customers", column: "industry", synonyms: ["vertical", "sector"] },
    ];
    for (const d of D) {
      db.insert(schema.dimensions).values({ workspaceId: ws.id, name: d.name, displayName: d.displayName, tableName: d.table, columnName: d.column, synonymsJson: JSON.stringify(d.synonyms) }).run();
    }
    console.log(`✓ seeded semantic layer: ${M.length} metrics, ${D.length} dimensions`);
  } else {
    console.log("• semantic layer exists");
  }

  // 6. starter dashboard
  const existingDash = db.select().from(schema.dashboards).where(eq(schema.dashboards.workspaceId, ws.id)).all();
  if (existingDash.length === 0) {
    const dash = db
      .insert(schema.dashboards)
      .values({ workspaceId: ws.id, title: "Company Overview", description: "Auto-generated executive snapshot.", summary: "Revenue, growth, engagement, and support health at a glance.", createdByUserId: user.id })
      .returning()
      .get();

    const tiles: { tileType: string; title: string; sql: string; chart: object }[] = [
      { tileType: "kpi", title: "Revenue (30d)", sql: "SELECT ROUND(SUM(amount),2) AS revenue FROM invoices WHERE status='paid' AND paid_at>=date('now','-30 days')", chart: { type: "kpi", title: "Revenue (30d)", valueField: "revenue", format: "currency" } },
      { tileType: "kpi", title: "Active Users (30d)", sql: "SELECT COUNT(DISTINCT user_id) AS active_users FROM events WHERE timestamp>=date('now','-30 days')", chart: { type: "kpi", title: "Active Users", valueField: "active_users", format: "number" } },
      { tileType: "kpi", title: "New Customers (30d)", sql: "SELECT COUNT(*) AS new_customers FROM customers WHERE created_at>=date('now','-30 days')", chart: { type: "kpi", title: "New Customers", valueField: "new_customers", format: "number" } },
      { tileType: "kpi", title: "Churned Subs (30d)", sql: "SELECT COUNT(*) AS churned FROM subscriptions WHERE status='canceled' AND canceled_at>=date('now','-30 days')", chart: { type: "kpi", title: "Churned", valueField: "churned", format: "number" } },
      { tileType: "chart", title: "Weekly Revenue", sql: "SELECT strftime('%Y-W%W', paid_at) AS week, ROUND(SUM(amount),2) AS revenue FROM invoices WHERE status='paid' AND paid_at>=date('now','-84 days') GROUP BY week ORDER BY week", chart: { type: "area", title: "Weekly Revenue", x: "week", y: "revenue", format: "currency" } },
      { tileType: "chart", title: "Revenue by Plan", sql: "SELECT plan, ROUND(SUM(amount),2) AS revenue FROM invoices WHERE status='paid' AND paid_at>=date('now','-30 days') GROUP BY plan ORDER BY revenue DESC", chart: { type: "bar", title: "Revenue by Plan", x: "plan", y: "revenue", format: "currency" } },
      { tileType: "chart", title: "Top Customers", sql: "SELECT c.name AS customer, ROUND(SUM(i.amount),2) AS revenue FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.status='paid' AND i.paid_at>=date('now','-30 days') GROUP BY c.id ORDER BY revenue DESC LIMIT 8", chart: { type: "horizontal_bar", title: "Top Customers", x: "customer", y: "revenue", format: "currency" } },
      { tileType: "chart", title: "Daily Support Tickets", sql: "SELECT date(created_at) AS day, COUNT(*) AS tickets FROM support_tickets WHERE created_at>=date('now','-30 days') GROUP BY day ORDER BY day", chart: { type: "line", title: "Daily Support Tickets", x: "day", y: "tickets" } },
    ];
    tiles.forEach((t, i) => {
      db.insert(schema.dashboardTiles).values({ dashboardId: dash.id, tileType: t.tileType, title: t.title, generatedSql: t.sql, chartConfigJson: JSON.stringify(t.chart), dataSourceId: ds.id, position: i }).run();
    });
    console.log(`✓ created Company Overview dashboard with ${tiles.length} tiles`);
  } else {
    console.log("• dashboard exists");
  }

  sqlite.close();
  console.log("\n✓ App seed complete. Login: demo@pulse.app / demo1234\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
