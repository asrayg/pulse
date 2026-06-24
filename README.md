# Pulse — Ask your data anything

**PowerBI if it was built for people who actually need answers.**

<p>
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg" />
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" />
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-22c55e.svg" />
</p>

> Connect a database or CSV, ask a question in plain English, and Pulse generates safe read-only
> SQL, runs it, charts the result, and explains what changed — then lets you save it as a
> dashboard or alert. Works fully offline with a deterministic planner; add an LLM key for full
> natural-language analysis.

Pulse is an AI-native business intelligence platform. Connect your data, ask questions in
plain English, generate dashboards instantly, and let an AI analyst explain what changed —
without wrestling with dashboard builders, DAX, or SQL.

It is **agent-first**, not dashboard-first. The unit of work is a *question*, and a dashboard
is just a saved answer with live data.

---

## The core magic (live demo path)

1. Log in to the seeded demo workspace (`demo@pulse.app` / `demo1234`).
2. Ask **"Why did revenue drop this week?"**
3. Pulse classifies intent → inspects schema → generates **read-only** SQL → validates it for
   safety → runs it → inspects the result → writes a business explanation → charts it.
4. You get a direct answer ("Revenue is down ~18% WoW, driven by enterprise churn and a paid-search
   slump"), a chart, the segment breakdown, the exact SQL, assumptions, a confidence level, and
   suggested follow-ups.
5. Save it as a question, **add it to a dashboard**, or **create an alert** from the result.

Every answer is reproducible: generated SQL, tables used, row count, timing, assumptions, and
validation checks are always shown. No black-box "AI said so" analytics.

---

## Quick start

```bash
pnpm install
pnpm setup       # db:push  +  seed:demo  +  seed:app   (creates data/pulse.db & data/demo.db)
pnpm dev         # http://localhost:3000
```

Then sign in with **demo@pulse.app / demo1234**, or create a fresh workspace (it auto-provisions
the same demo dataset, semantic layer, and starter dashboard).

### Environment

Copy `.env.example` → `.env.local`. Secrets for `AUTH_SECRET` and `PULSE_ENCRYPTION_KEY` are
generated for you during setup, or generate your own.

**LLM is optional.** With no API key, Pulse runs a built-in **deterministic planner** that handles
the common business questions against the demo schema — so the product is fully demo-able offline.
Add one of these for full natural-language SQL generation:

```
AI_GATEWAY_API_KEY=...        # Vercel AI Gateway (recommended) — uses "anthropic/claude-..." strings
# or
ANTHROPIC_API_KEY=...
PULSE_MODEL=anthropic/claude-sonnet-4-6
```

---

## Architecture

```
Question
  → intent classification
  → context retrieval (schema + semantic layer)
  → analysis plan
  → SQL generation            (LLM, or deterministic planner)
  → SQL safety validation     (read-only gate; forbidden keywords; LIMIT injection)
  → execution                 (read-only adapter, timeout, row cap)
  → result inspection         (empty / null-heavy / suspicious → one repair attempt)
  → answer + chart + explanation
  → optional: save question / dashboard tile / alert
```

### Tech

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** (strict)
- **Tailwind v4** + a hand-built shadcn-style design system (dark-first)
- **Drizzle ORM** + **better-sqlite3** for the app database (zero external services)
- **Recharts** for charts; a custom sortable data table
- **Vercel AI SDK v6** for the agent (AI Gateway or direct Anthropic), with a deterministic fallback
- External data via **adapters**: Postgres (read-only), SQLite, and CSV (materialized to SQLite)

### Safety

- All external connections default to **read-only** (Postgres sets `default_transaction_read_only`;
  SQLite opens `readonly`).
- `lib/sql/safety.ts` rejects anything that isn't a single `SELECT`/`WITH`: blocks
  `INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE/CREATE/REPLACE/MERGE/GRANT/REVOKE/CALL/EXECUTE`,
  stacked statements, file/network functions, and injects a `LIMIT`. Sensitive columns
  (password/token/secret/PII) are flagged.
- External DB credentials are encrypted at rest (AES-256-GCM, `lib/crypto.ts`).

---

## Project structure

```
app/
  (auth)/            login, signup
  (app)/             home, ask, dashboards, data-sources, semantic-layer, alerts, history, settings
  api/               auth, agent/ask, query/run, dashboards, saved-questions, alerts, metrics,
                     dimensions, data-sources, files, query-runs, workspaces
lib/
  agent/             pipeline, prompt, intent/fallback, llm, inspect
  adapters/          sqlite, postgres, csv (via sqlite), schema inference
  sql/               safety validator
  db/                drizzle schema, client, seeds
  semantic/          semantic-layer context builder
  charts/            chart recommendation
components/
  ui/  layout/  ask/  dashboard/  charts/  data-table/  semantic/  alerts/  history/  settings/
```

## Demo dataset

A realistic fake B2B SaaS dataset (`pnpm seed:demo`) with `customers`, `subscriptions`,
`invoices`, `payments`, `users`, `events`, `support_tickets`, `sales_opportunities`. It is
deliberately seeded with a **week-over-week revenue drop** (enterprise churn + paid-search slump)
so the flagship root-cause question has a real story to find.

## Scripts

| command | what |
|---|---|
| `pnpm setup` | push schema + seed demo dataset + seed app (user/workspace/dashboard) |
| `pnpm dev` | start the dev server |
| `pnpm build` | production build |
| `pnpm seed:demo` | regenerate the demo SaaS dataset |
| `pnpm seed:app` | (re)seed the demo user, workspace, semantic layer, dashboard |

## Contributing

Contributions are very welcome — new data-source adapters, agent improvements, chart types, and
docs especially. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup and guidelines, and
[good first issues](https://github.com/asrayg/pulse/issues) to get started.

Before opening a PR: `pnpm typecheck && pnpm build` must pass.

## Security

Pulse connects to data **read-only** and validates every query. Found a vulnerability? Please
report it privately — see [`SECURITY.md`](./SECURITY.md). Do not open a public issue for security
reports.

## License

[MIT](./LICENSE) © Asray Gopa

---

Built as a polished MVP: real app, real database, real agent loop, real SQL safety. Not a mockup.
