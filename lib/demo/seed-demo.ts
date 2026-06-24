/**
 * Seeds data/demo.db with a realistic fake B2B SaaS dataset.
 *
 * Designed so the flagship demo question — "why did revenue drop this week?"
 * — has a genuine, discoverable story: the most recent week's revenue is down
 * ~18% WoW, driven mostly by (a) two enterprise subscriptions churning and
 * (b) a slump in invoices from the "paid_search" acquisition channel.
 *
 * Deterministic (seeded PRNG) so demos are reproducible.
 *
 * Run: pnpm seed:demo
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const OUT = process.env.PULSE_DEMO_DB_PATH ?? path.join(process.cwd(), "data", "demo.db");

// ---- seeded RNG -------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(424242);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p: number) => rnd() < p;

// ---- date helpers (anchored to 2026-06-23) ----------------------------------
const NOW = new Date("2026-06-23T12:00:00Z");
const day = 86400000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * day);
const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// ---- reference data ---------------------------------------------------------
const INDUSTRIES = ["SaaS", "Fintech", "Healthcare", "E-commerce", "Logistics", "Media", "Education", "Gaming"];
const REGIONS = ["North America", "Europe", "APAC", "LATAM"];
const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const PLANS = ["free", "starter", "pro", "business", "enterprise"];
const PLAN_PRICE: Record<string, number> = { free: 0, starter: 49, pro: 199, business: 499, enterprise: 2200 };
const MANAGERS = ["Ava Chen", "Marcus Webb", "Priya Nair", "Diego Santos", "Lena Fischer", "Tom Okafor"];
const CHANNELS = ["organic", "paid_search", "referral", "social", "outbound", "events"];
const DEVICES = ["desktop", "mobile", "tablet"];
const EVENTS = ["login", "dashboard_view", "report_export", "invite_sent", "feature_used", "api_call", "settings_changed"];
const TICKET_CAT = ["billing", "bug", "how_to", "feature_request", "outage", "onboarding"];
const TICKET_PRIORITY = ["low", "medium", "high", "urgent"];
const OPP_STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];
const FIRST = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark", "Wayne", "Wonka", "Soylent", "Cyberdyne", "Tyrell", "Vandelay", "Pied Piper", "Aperture", "Massive Dynamic", "Gekko", "Oscorp", "Bluth", "Prestige", "Nakatomi"];
const SECOND = ["Industries", "Labs", "Corp", "Systems", "Group", "Technologies", "Analytics", "Cloud", "Digital", "Works", "Partners", "Solutions"];

// ---- build DB ---------------------------------------------------------------
fs.mkdirSync(path.dirname(OUT), { recursive: true });
if (fs.existsSync(OUT)) fs.rmSync(OUT);
const db = new Database(OUT);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE customers (
  id INTEGER PRIMARY KEY, name TEXT, industry TEXT, region TEXT, company_size TEXT,
  created_at TEXT, account_manager TEXT, status TEXT, plan TEXT
);
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY, customer_id INTEGER, plan TEXT, monthly_amount REAL,
  status TEXT, started_at TEXT, canceled_at TEXT
);
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY, customer_id INTEGER, amount REAL, status TEXT,
  issued_at TEXT, paid_at TEXT, plan TEXT, channel TEXT
);
CREATE TABLE payments (
  id INTEGER PRIMARY KEY, invoice_id INTEGER, customer_id INTEGER, amount REAL, method TEXT, paid_at TEXT
);
CREATE TABLE users (
  id INTEGER PRIMARY KEY, customer_id INTEGER, name TEXT, email TEXT, role TEXT,
  created_at TEXT, last_active_at TEXT, signup_channel TEXT
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY, user_id INTEGER, customer_id INTEGER, event_name TEXT,
  timestamp TEXT, device TEXT, source TEXT
);
CREATE TABLE support_tickets (
  id INTEGER PRIMARY KEY, customer_id INTEGER, priority TEXT, status TEXT,
  created_at TEXT, resolved_at TEXT, category TEXT
);
CREATE TABLE sales_opportunities (
  id INTEGER PRIMARY KEY, customer_id INTEGER, stage TEXT, amount REAL, owner TEXT,
  expected_close_date TEXT, created_at TEXT
);
`);

interface Cust { id: number; name: string; plan: string; channel: string; createdAt: Date; status: string; }
const customers: Cust[] = [];
const N_CUST = 140;

const insCust = db.prepare(`INSERT INTO customers VALUES (?,?,?,?,?,?,?,?,?)`);
for (let i = 1; i <= N_CUST; i++) {
  const created = daysAgo(int(20, 540));
  const plan = pick(PLANS.filter((p) => p !== "free" || chance(0.5)));
  const channel = pick(CHANNELS);
  // ~8% churned historically
  const status = chance(0.08) ? "churned" : "active";
  const name = `${pick(FIRST)} ${pick(SECOND)}${chance(0.3) ? " " + int(2, 99) : ""}`;
  customers.push({ id: i, name, plan, channel, createdAt: created, status });
  insCust.run(i, name, pick(INDUSTRIES), pick(REGIONS), pick(SIZES), iso(created), pick(MANAGERS), status, plan);
}

// subscriptions ---------------------------------------------------------------
const insSub = db.prepare(`INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?)`);
let subId = 1;
const enterpriseActive: Cust[] = [];
for (const c of customers) {
  if (c.plan === "free") continue;
  const amount = PLAN_PRICE[c.plan] * (1 + (rnd() - 0.5) * 0.2);
  let status = c.status === "churned" ? "canceled" : "active";
  let canceled: string | null = null;
  const started = new Date(c.createdAt.getTime() + int(0, 5) * day);
  if (status === "canceled") canceled = iso(daysAgo(int(10, 200)));
  insSub.run(subId++, c.id, c.plan, Math.round(amount), status, iso(started), canceled);
  if (c.plan === "enterprise" && status === "active") enterpriseActive.push(c);
}

// STORY: cancel 2 enterprise subs in the last 6 days to drive the WoW drop.
const churnThisWeek = enterpriseActive.slice(0, 2);
const insSub2 = db.prepare(`UPDATE subscriptions SET status='canceled', canceled_at=? WHERE customer_id=? AND plan='enterprise'`);
for (const c of churnThisWeek) {
  insSub2.run(iso(daysAgo(int(1, 5))), c.id);
  c.status = "churning";
}

// invoices + payments ---------------------------------------------------------
const insInv = db.prepare(`INSERT INTO invoices VALUES (?,?,?,?,?,?,?,?)`);
const insPay = db.prepare(`INSERT INTO payments VALUES (?,?,?,?,?,?)`);
let invId = 1;
let payId = 1;
const WEEKS = 18;
for (let w = WEEKS; w >= 0; w--) {
  const isThisWeek = w === 0;
  for (const c of customers) {
    if (c.plan === "free") continue;
    if (c.createdAt > daysAgo(w * 7)) continue; // not a customer yet
    // base monthly billing roughly weekly cadence — most customers invoiced ~1/wk
    let billProb = 0.55;
    // STORY drivers for the current week:
    if (isThisWeek) {
      if (c.channel === "paid_search") billProb = 0.2; // paid search slump
      if (c.status === "churning") billProb = 0.0; // enterprise churn — no invoice
      else billProb *= 0.78; // mild overall softness
    }
    if (!chance(billProb)) continue;
    const issued = daysAgo(w * 7 + int(0, 6));
    let amount = PLAN_PRICE[c.plan] * (0.9 + rnd() * 0.4);
    if (isThisWeek && c.plan === "enterprise") amount *= 0.7; // fewer upgrades
    amount = Math.round(amount);
    const paid = chance(0.9);
    const paidAt = paid ? iso(new Date(issued.getTime() + int(0, 3) * day)) : null;
    insInv.run(invId, c.id, amount, paid ? "paid" : "open", iso(issued), paidAt, c.plan, c.channel);
    if (paid) {
      insPay.run(payId++, invId, c.id, amount, pick(["card", "ach", "wire"]), paidAt);
    }
    invId++;
  }
}

// users + events --------------------------------------------------------------
const insUser = db.prepare(`INSERT INTO users VALUES (?,?,?,?,?,?,?,?)`);
const insEvent = db.prepare(`INSERT INTO events VALUES (?,?,?,?,?,?,?)`);
let userId = 1;
let eventId = 1;
const allUsers: { id: number; custId: number }[] = [];
for (const c of customers) {
  const seats = c.plan === "enterprise" ? int(8, 25) : c.plan === "business" ? int(4, 12) : int(1, 5);
  for (let s = 0; s < seats; s++) {
    const created = new Date(c.createdAt.getTime() + int(0, 30) * day);
    const lastActive = daysAgo(int(0, c.status === "churned" ? 120 : 14));
    const fn = pick(["Sam", "Alex", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Jamie", "Quinn", "Drew"]);
    const ln = pick(["Lee", "Patel", "Kim", "Garcia", "Müller", "Sato", "Brown", "Ali", "Rossi", "Novak"]);
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${userId}@${c.name.split(" ")[0].toLowerCase()}.com`;
    insUser.run(userId, c.id, `${fn} ${ln}`, email, pick(["admin", "member", "viewer"]), iso(created), iso(lastActive), c.channel);
    allUsers.push({ id: userId, custId: c.id });
    userId++;
  }
}
// events over the last 60 days; signups drop slightly this week for the story
for (let d = 60; d >= 0; d--) {
  const isThisWeek = d <= 6;
  const baseCount = int(60, 110);
  const count = isThisWeek ? Math.floor(baseCount * 0.85) : baseCount;
  for (let e = 0; e < count; e++) {
    const u = pick(allUsers);
    const ts = new Date(daysAgo(d).getTime() + int(0, 86399) * 1000);
    insEvent.run(eventId++, u.id, u.custId, pick(EVENTS), iso(ts), pick(DEVICES), pick(CHANNELS));
  }
}

// support tickets -------------------------------------------------------------
const insTicket = db.prepare(`INSERT INTO support_tickets VALUES (?,?,?,?,?,?,?)`);
let ticketId = 1;
for (let d = 90; d >= 0; d--) {
  const isThisWeek = d <= 6;
  const count = isThisWeek ? int(8, 16) : int(3, 9); // tickets spike this week
  for (let t = 0; t < count; t++) {
    const c = pick(customers);
    const created = new Date(daysAgo(d).getTime() + int(0, 86399) * 1000);
    const resolved = chance(0.7) ? iso(new Date(created.getTime() + int(1, 72) * 3600000)) : null;
    insTicket.run(ticketId++, c.id, pick(TICKET_PRIORITY), resolved ? "resolved" : "open", iso(created), resolved, pick(TICKET_CAT));
  }
}

// sales opportunities ---------------------------------------------------------
const insOpp = db.prepare(`INSERT INTO sales_opportunities VALUES (?,?,?,?,?,?,?)`);
let oppId = 1;
for (let i = 0; i < 90; i++) {
  const c = pick(customers);
  const created = daysAgo(int(0, 120));
  const stage = pick(OPP_STAGES);
  const amount = Math.round(PLAN_PRICE[pick(["pro", "business", "enterprise"])] * int(6, 18));
  const close = new Date(created.getTime() + int(10, 90) * day);
  insOpp.run(oppId++, c.id, stage, amount, pick(MANAGERS), isoDate(close), iso(created));
}

const counts = ["customers", "subscriptions", "invoices", "payments", "users", "events", "support_tickets", "sales_opportunities"]
  .map((t) => `${t}=${(db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c}`)
  .join("  ");

db.close();
console.log(`✓ Seeded demo dataset → ${OUT}`);
console.log("  " + counts);
console.log(`  Story: ${churnThisWeek.length} enterprise accounts churned this week; paid_search invoices down sharply.`);
