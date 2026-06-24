## What & why

<!-- What does this change and why? Link any related issue (e.g. Closes #123). -->

## How to test

<!-- Steps for a reviewer to verify the change. -->

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] No server modules imported into `"use client"` components
- [ ] Any SQL execution paths still go through `validateSql()` + a read-only adapter
- [ ] Updated docs/README if behavior changed
