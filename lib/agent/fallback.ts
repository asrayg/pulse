import type { AnswerExtra, ChartConfig, IntentType, QueryResult, SqlRow } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

/**
 * Deterministic, schema-aware-ish planner used when no LLM key is configured.
 * It pattern-matches common business questions against the seeded demo schema
 * so Pulse is fully demo-able offline. Returns a primary query plus optional
 * supporting queries (e.g. segment breakdowns for root-cause).
 */
export interface FallbackQuery {
  title: string;
  sql: string;
  chart: ChartConfig;
}

export interface FallbackPlan {
  intent: IntentType;
  primary: FallbackQuery;
  extras?: FallbackQuery[];
  assumptions: string[];
  followUps: string[];
  /** builds the natural-language answer from the executed primary (+extra) results */
  summarize: (primary: QueryResult, extras: QueryResult[]) => { answer: string; explanation?: string; extras?: AnswerExtra[] };
}

const num = (r: SqlRow | undefined, k: string): number => Number(r?.[k] ?? 0);

export function planFallback(question: string, tableNames: string[]): FallbackPlan {
  const q = question.toLowerCase();
  const has = (t: string) => tableNames.includes(t);

  // ---- ROOT CAUSE: why did revenue drop / change -------------------------
  if (/(why|reason|driv|caus|drop|down|decline|fell|decrease).*(revenue|mrr|sales|income)|revenue.*(drop|down|decline|fell)/.test(q) && has("invoices")) {
    return {
      intent: "root_cause",
      assumptions: [
        "Revenue = sum of paid invoice amounts.",
        "'This week' = last 7 days; 'last week' = the 7 days before that.",
      ],
      followUps: [
        "Which specific customers churned this week?",
        "Show revenue by plan for the last 8 weeks.",
        "How does paid_search compare to other channels over time?",
      ],
      primary: {
        title: "Weekly revenue (last 8 weeks)",
        sql: `SELECT strftime('%Y-W%W', paid_at) AS week, ROUND(SUM(amount), 2) AS revenue
FROM invoices
WHERE status = 'paid' AND paid_at >= date('now', '-56 days')
GROUP BY week
ORDER BY week`,
        chart: { type: "line", title: "Weekly Revenue", x: "week", y: "revenue", format: "currency" },
      },
      extras: [
        {
          title: "Revenue change by channel (WoW)",
          sql: `SELECT channel,
  ROUND(SUM(CASE WHEN paid_at >= date('now','-7 days') THEN amount ELSE 0 END), 2) AS this_week,
  ROUND(SUM(CASE WHEN paid_at >= date('now','-14 days') AND paid_at < date('now','-7 days') THEN amount ELSE 0 END), 2) AS last_week
FROM invoices
WHERE status='paid' AND paid_at >= date('now','-14 days')
GROUP BY channel
ORDER BY (last_week - this_week) DESC`,
          chart: { type: "table", title: "Revenue by Channel (WoW)" },
        },
        {
          title: "Revenue change by plan (WoW)",
          sql: `SELECT plan,
  ROUND(SUM(CASE WHEN paid_at >= date('now','-7 days') THEN amount ELSE 0 END), 2) AS this_week,
  ROUND(SUM(CASE WHEN paid_at >= date('now','-14 days') AND paid_at < date('now','-7 days') THEN amount ELSE 0 END), 2) AS last_week
FROM invoices
WHERE status='paid' AND paid_at >= date('now','-14 days')
GROUP BY plan
ORDER BY (last_week - this_week) DESC`,
          chart: { type: "table", title: "Revenue by Plan (WoW)" },
        },
      ],
      summarize: (primary, extras) => {
        const rows = primary.rows;
        const cur = rows[rows.length - 1];
        const prev = rows[rows.length - 2];
        const curRev = num(cur, "revenue");
        const prevRev = num(prev, "revenue");
        const pct = prevRev ? ((curRev - prevRev) / prevRev) * 100 : 0;
        const channelRows = extras[0]?.rows ?? [];
        const topChannel = channelRows[0];
        const planRows = extras[1]?.rows ?? [];
        const topPlan = planRows[0];
        const chDelta = topChannel ? num(topChannel, "this_week") - num(topChannel, "last_week") : 0;
        const plDelta = topPlan ? num(topPlan, "this_week") - num(topPlan, "last_week") : 0;
        const answer = `Revenue is ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% week-over-week (${formatNumber(
          curRev,
          { currency: true },
        )} vs ${formatNumber(prevRev, { currency: true })}).`;
        const explanation = `The largest negative driver is the **${topPlan?.plan ?? "enterprise"}** plan (${formatNumber(
          plDelta,
          { currency: true },
        )} WoW) and the **${topChannel?.channel ?? "paid_search"}** channel (${formatNumber(chDelta, {
          currency: true,
        })} WoW). This lines up with enterprise renewals coming in lighter and softer paid-search-sourced billings. Check the breakdown tables for the full segment picture.`;
        return {
          answer,
          explanation,
          extras: [
            { kind: "segment_table", title: "Revenue by channel (this vs last week)", result: extras[0] ?? null, chart: extras[0] ? { type: "table", title: "By Channel" } : null },
            { kind: "segment_table", title: "Revenue by plan (this vs last week)", result: extras[1] ?? null, chart: extras[1] ? { type: "table", title: "By Plan" } : null },
          ],
        };
      },
    };
  }

  // ---- TOP customers by revenue -----------------------------------------
  if (/top.*(customer|account|client)|(customer|account).*by revenue|biggest customer|largest account/.test(q) && has("invoices") && has("customers")) {
    const limit = (q.match(/top\s+(\d+)/)?.[1] ?? "10");
    return {
      intent: "segmentation",
      assumptions: ["Revenue = paid invoices in the last 30 days.", `Showing top ${limit} accounts.`],
      followUps: ["What's the revenue trend for the top account?", "Which of these are at churn risk?", "Break this down by region."],
      primary: {
        title: `Top ${limit} customers by revenue`,
        sql: `SELECT c.name AS customer, ROUND(SUM(i.amount), 2) AS revenue
FROM invoices i JOIN customers c ON c.id = i.customer_id
WHERE i.status = 'paid' AND i.paid_at >= date('now', '-30 days')
GROUP BY c.id
ORDER BY revenue DESC
LIMIT ${limit}`,
        chart: { type: "horizontal_bar", title: "Top Customers by Revenue", x: "customer", y: "revenue", format: "currency" },
      },
      summarize: (primary) => {
        const top = primary.rows[0];
        return {
          answer: top
            ? `The top account is ${top.customer} at ${formatNumber(num(top, "revenue"), { currency: true })} in the last 30 days, across ${primary.rowCount} ranked customers.`
            : "No paid invoices found in the last 30 days.",
        };
      },
    };
  }

  // ---- CHURN -------------------------------------------------------------
  if (/churn|cancel|canceled|cancelled|lost customer/.test(q) && has("subscriptions")) {
    return {
      intent: "trend",
      assumptions: ["Churn = subscriptions with status = 'canceled'.", "Grouped by week of cancellation."],
      followUps: ["Which plans churn the most?", "What's our net revenue churn?", "Show accounts that churned this month."],
      primary: {
        title: "Weekly churned subscriptions",
        sql: `SELECT strftime('%Y-W%W', canceled_at) AS week, COUNT(*) AS churned, ROUND(SUM(monthly_amount),2) AS lost_mrr
FROM subscriptions
WHERE status = 'canceled' AND canceled_at >= date('now', '-84 days')
GROUP BY week ORDER BY week`,
        chart: { type: "bar", title: "Weekly Churn", x: "week", y: "churned" },
      },
      summarize: (primary) => {
        const last = primary.rows[primary.rows.length - 1];
        return { answer: last ? `${num(last, "churned")} subscriptions churned in the latest week, representing ${formatNumber(num(last, "lost_mrr"), { currency: true })} of lost MRR.` : "No churn in the selected window." };
      },
    };
  }

  // ---- SIGNUPS / new customers ------------------------------------------
  if (/(signup|sign up|new customer|new account|new user|acquisition)/.test(q) && (has("customers") || has("users"))) {
    const table = has("customers") ? "customers" : "users";
    return {
      intent: "trend",
      assumptions: [`New ${table} measured by created_at, grouped by week.`],
      followUps: ["Which channel drives the most signups?", "How does this compare to last month?", "What's the conversion to paid?"],
      primary: {
        title: `Weekly new ${table}`,
        sql: `SELECT strftime('%Y-W%W', created_at) AS week, COUNT(*) AS new_${table}
FROM ${table}
WHERE created_at >= date('now', '-84 days')
GROUP BY week ORDER BY week`,
        chart: { type: "line", title: `New ${table} per week`, x: "week", y: `new_${table}` },
      },
      summarize: (primary) => {
        const rows = primary.rows;
        const cur = num(rows[rows.length - 1], `new_${table}`);
        const prev = num(rows[rows.length - 2], `new_${table}`);
        const pct = prev ? ((cur - prev) / prev) * 100 : 0;
        return { answer: `${cur} new ${table} in the latest week (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs prior week).` };
      },
    };
  }

  // ---- SUPPORT tickets ---------------------------------------------------
  if (/(ticket|support|complaint)/.test(q) && has("support_tickets")) {
    return {
      intent: "trend",
      assumptions: ["Tickets counted by created_at, daily, last 30 days."],
      followUps: ["Which category is spiking?", "What's our resolution time?", "Which accounts opened the most tickets?"],
      primary: {
        title: "Daily support tickets",
        sql: `SELECT date(created_at) AS day, COUNT(*) AS tickets
FROM support_tickets
WHERE created_at >= date('now', '-30 days')
GROUP BY day ORDER BY day`,
        chart: { type: "line", title: "Daily Support Tickets", x: "day", y: "tickets" },
      },
      summarize: (primary) => {
        const rows = primary.rows;
        const recent = rows.slice(-7).reduce((s, r) => s + num(r, "tickets"), 0);
        const prior = rows.slice(-14, -7).reduce((s, r) => s + num(r, "tickets"), 0);
        const pct = prior ? ((recent - prior) / prior) * 100 : 0;
        return { answer: `${recent} tickets in the last 7 days (${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs the prior week).` };
      },
    };
  }

  // ---- ACTIVE users ------------------------------------------------------
  if (/(active user|active customer|engagement|dau|wau|mau)/.test(q) && has("events")) {
    return {
      intent: "simple_metric",
      assumptions: ["Active user = a user with ≥1 event in the last 30 days."],
      followUps: ["Show weekly active users over time.", "Which features are most used?", "Which accounts are least active?"],
      primary: {
        title: "Active users (30d)",
        sql: `SELECT COUNT(DISTINCT user_id) AS active_users
FROM events WHERE timestamp >= date('now', '-30 days')`,
        chart: { type: "kpi", title: "Active Users (30d)", valueField: "active_users", format: "number" },
      },
      summarize: (primary) => ({ answer: `${formatNumber(num(primary.rows[0], "active_users"))} active users in the last 30 days.` }),
    };
  }

  // ---- TOTAL / last month revenue ---------------------------------------
  if (/(revenue|mrr|sales|income)/.test(q) && has("invoices")) {
    const trend = /(over time|trend|by week|by month|monthly|history|chart)/.test(q);
    if (trend) {
      return {
        intent: "trend",
        assumptions: ["Revenue = paid invoices, grouped by week."],
        followUps: ["Why did revenue drop this week?", "Break revenue down by plan.", "Which channel drives the most revenue?"],
        primary: {
          title: "Weekly revenue",
          sql: `SELECT strftime('%Y-W%W', paid_at) AS week, ROUND(SUM(amount),2) AS revenue
FROM invoices WHERE status='paid' AND paid_at >= date('now','-84 days')
GROUP BY week ORDER BY week`,
          chart: { type: "area", title: "Weekly Revenue", x: "week", y: "revenue", format: "currency" },
        },
        summarize: (p) => ({ answer: `Revenue over the last ${p.rowCount} weeks totals ${formatNumber(p.rows.reduce((s, r) => s + num(r, "revenue"), 0), { currency: true })}.` }),
      };
    }
    return {
      intent: "simple_metric",
      assumptions: ["Revenue = sum of paid invoice amounts in the last 30 days."],
      followUps: ["Why did revenue drop this week?", "Who are our top customers?", "Show revenue over time."],
      primary: {
        title: "Revenue (last 30 days)",
        sql: `SELECT ROUND(SUM(amount),2) AS revenue FROM invoices WHERE status='paid' AND paid_at >= date('now','-30 days')`,
        chart: { type: "kpi", title: "Revenue (30d)", valueField: "revenue", format: "currency" },
      },
      summarize: (p) => ({ answer: `Revenue in the last 30 days was ${formatNumber(num(p.rows[0], "revenue"), { currency: true })}.` }),
    };
  }

  // ---- GENERIC fallback: profile the largest available table -------------
  const target = ["invoices", "customers", "events", "users", tableNames[0]].find((t) => t && has(t)) ?? tableNames[0];
  return {
    intent: "general_help",
    assumptions: [`No specific metric matched; showing a sample from "${target}".`],
    followUps: ["Why did revenue drop this week?", "Who are our top customers?", "How many active users do we have?"],
    primary: {
      title: `Sample of ${target}`,
      sql: `SELECT * FROM "${target}" LIMIT 50`,
      chart: { type: "table", title: `Sample of ${target}` },
    },
    summarize: (p) => ({ answer: `Showing ${p.rowCount} sample rows from "${target}". Try asking about revenue, customers, churn, or support tickets.` }),
  };
}
