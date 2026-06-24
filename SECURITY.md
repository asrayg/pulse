# Security Policy

Pulse is designed around a strict safety posture: it connects to data sources **read-only**
and validates every query before execution. We take security issues seriously.

## Reporting a vulnerability

Please **do not open a public issue** for security vulnerabilities.

Instead, report privately via [GitHub Security Advisories](https://github.com/asrayg/pulse/security/advisories/new)
or email **asraygopa@gmail.com**. We'll acknowledge within a few days and work with you on a fix
and coordinated disclosure.

When reporting, please include: a description, reproduction steps, affected versions/commit, and
impact.

## Security model

- **Read-only by design.** Postgres connections set `default_transaction_read_only`; SQLite is
  opened in `readonly` mode. CSVs are materialized into an isolated per-file SQLite database.
- **SQL safety gate** (`lib/sql/safety.ts`): only single `SELECT`/`WITH` statements run. Blocked:
  `INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, REPLACE, MERGE, GRANT, REVOKE, CALL,
  EXECUTE`, stacked statements, comment-hidden SQL, and file/network functions. A `LIMIT` is
  injected when missing.
- **Credentials at rest** are encrypted with AES-256-GCM (`lib/crypto.ts`) and never exposed to
  the client.
- **Sensitive columns** (password/token/secret/API key/SSN/card) are flagged by the validator.

## Hardening for production

- Set strong, unique `AUTH_SECRET` and `PULSE_ENCRYPTION_KEY` (32 bytes).
- Always connect external databases with a **least-privilege, read-only** database user — the
  application gate is defense-in-depth, not a substitute for proper DB permissions.
- Serve over HTTPS and review the LLM provider's data-retention policy before sending schema
  or sample data to it.
