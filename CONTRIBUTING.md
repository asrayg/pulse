# Contributing to Pulse

Thanks for your interest in improving Pulse! This project is an agent-first BI platform,
and contributions of all kinds are welcome — bug fixes, new data-source adapters, agent
improvements, UI polish, and docs.

## Getting started

```bash
git clone https://github.com/asrayg/pulse.git
cd pulse
pnpm install
cp .env.example .env.local      # then fill in / generate secrets (see README)
pnpm setup                      # creates data/pulse.db + data/demo.db
pnpm dev                        # http://localhost:3000  (demo@pulse.app / demo1234)
```

Requires **Node ≥ 20.9** and **pnpm**.

## Before you open a PR

```bash
pnpm typecheck     # must pass — TypeScript is strict
pnpm build         # must pass — type-checks + builds all routes
pnpm lint
```

- Keep changes focused; one logical change per PR.
- Match the existing code style: typed interfaces, small reusable components, the dark
  design-token palette (`bg-card`, `border-border`, `text-muted-foreground`, …).
- **Client components** (`"use client"`) may only import `react`, `next/*`, `lucide-react`,
  `@/components/**`, `@/lib/utils`, and type-only from `@/lib/types`. Never import server
  modules (`@/lib/db`, `@/lib/api`, `@/lib/adapters`, `@/lib/crypto`) into client code.
- **SQL safety is non-negotiable.** Any code path that runs SQL against a connected source
  must go through `validateSql()` and a read-only adapter. Don't add write paths to external
  data. If you touch `lib/sql/safety.ts`, add tests/notes describing what you changed.

## Good first issues

- New read-only adapters (MySQL, BigQuery, Snowflake) implementing the `DbAdapter` interface
  in `lib/types.ts`.
- Expanding the deterministic planner (`lib/agent/fallback.ts`) to cover more question shapes.
- Chart types and the chart recommender (`lib/charts/recommend.ts`).
- Accessibility and keyboard-shortcut improvements.

## Architecture

See the **Architecture** section of [`README.md`](./README.md) for the agent pipeline and
the directory layout.

## Reporting bugs / requesting features

Use the GitHub issue templates. For anything security-related, follow
[`SECURITY.md`](./SECURITY.md) instead of opening a public issue.

By contributing, you agree that your contributions are licensed under the MIT License.
