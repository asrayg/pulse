import type { SqlValidation } from "@/lib/types";

/**
 * Read-only SQL safety validator. Pulse must NEVER mutate connected data, so
 * this is a hard gate executed before any query runs. It is intentionally
 * conservative: when in doubt, reject.
 */

const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "create",
  "replace",
  "merge",
  "grant",
  "revoke",
  "call",
  "execute",
  "exec",
  "attach",
  "detach",
  "pragma",
  "vacuum",
  "reindex",
  "commit",
  "rollback",
  "savepoint",
  "into", // SELECT ... INTO
];

// Functions that can read files / reach the network / leak server state.
const FORBIDDEN_FUNCTIONS = [
  "load_extension",
  "readfile",
  "writefile",
  "fts3_tokenizer",
  "pg_read_file",
  "pg_ls_dir",
  "pg_sleep",
  "lo_import",
  "lo_export",
  "dblink",
  "copy",
  "load_file",
  "sys_exec",
  "into outfile",
  "into dumpfile",
];

const SENSITIVE_COLUMN_PATTERNS = [
  /password/i,
  /passwd/i,
  /\bpwd\b/i,
  /secret/i,
  /api[_-]?key/i,
  /\btoken\b/i,
  /\bssn\b/i,
  /social_security/i,
  /credit_card/i,
  /card_number/i,
  /\bcvv\b/i,
  /private_key/i,
  /access_key/i,
];

const DEFAULT_LIMIT = 1000;

/** Strip string literals and comments so keyword scanning can't be fooled. */
function stripLiteralsAndComments(sql: string): string {
  let out = sql;
  // line comments
  out = out.replace(/--[^\n]*/g, " ");
  // block comments
  out = out.replace(/\/\*[\s\S]*?\*\//g, " ");
  // single-quoted strings
  out = out.replace(/'(?:[^']|'')*'/g, "''");
  // double-quoted identifiers -> keep but emptied to avoid false keyword hits
  out = out.replace(/"(?:[^"]|"")*"/g, '""');
  return out;
}

function hasMultipleStatements(stripped: string): boolean {
  // Remove a single trailing semicolon, then any remaining one means 2+ stmts.
  const trimmed = stripped.trim().replace(/;\s*$/, "");
  return trimmed.includes(";");
}

export function validateSql(
  rawSql: string,
  opts?: { maxRows?: number; knownTables?: string[]; dialect?: "sqlite" | "postgres" | "mysql" },
): SqlValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxRows = opts?.maxRows ?? DEFAULT_LIMIT;

  let sql = (rawSql ?? "").trim();
  if (!sql) {
    return { ok: false, errors: ["Empty SQL."], warnings, safeSql: "" };
  }
  // Drop a trailing semicolon for analysis & execution.
  sql = sql.replace(/;\s*$/, "");

  const stripped = stripLiteralsAndComments(sql).toLowerCase();

  // 1. Must be a read-only query.
  if (!/^\s*(select|with)\b/.test(stripped)) {
    errors.push("Only SELECT / WITH (read-only) queries are allowed.");
  }

  // 2. No stacked statements.
  if (hasMultipleStatements(stripped)) {
    errors.push("Multiple SQL statements are not allowed.");
  }

  // 3. Forbidden keywords (word-boundary matched on the stripped text).
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(stripped)) {
      // `with` recursive uses `create`? no. `replace()` function is allowed though.
      if (kw === "replace" && /\breplace\s*\(/.test(stripped)) continue; // REPLACE() string fn
      errors.push(`Forbidden keyword: ${kw.toUpperCase()}.`);
    }
  }

  // 4. Forbidden functions / file & network access.
  for (const fn of FORBIDDEN_FUNCTIONS) {
    if (stripped.includes(fn)) {
      errors.push(`Forbidden function or construct: ${fn}.`);
    }
  }

  // 5. System catalog access (allow a small allowlist of harmless ones is omitted; warn).
  if (/\b(pg_catalog|information_schema|sqlite_master|sqlite_schema|mysql\.)\b/.test(stripped)) {
    warnings.push("Query touches system catalogs; results may expose schema metadata.");
  }

  // 6. Cross join smell.
  if (/\bcross\s+join\b/.test(stripped)) {
    warnings.push("CROSS JOIN detected — verify this is intentional.");
  }

  // 7. Sensitive columns referenced explicitly.
  for (const pat of SENSITIVE_COLUMN_PATTERNS) {
    if (pat.test(sql)) {
      warnings.push("Query references a potentially sensitive column (password/token/secret/PII).");
      break;
    }
  }

  // 8. Known-table check (best-effort; only when we have a schema).
  if (opts?.knownTables && opts.knownTables.length && errors.length === 0) {
    const known = new Set(opts.knownTables.map((t) => t.toLowerCase()));
    const refs = extractTableRefs(stripped);
    for (const r of refs) {
      const bare = r.split(".").pop()!;
      if (!known.has(r) && !known.has(bare)) {
        warnings.push(`Referenced table "${r}" was not found in the introspected schema.`);
      }
    }
  }

  // 9. Inject a LIMIT when the outer query has none (raw/unbounded selects).
  let safeSql = sql;
  const hasLimit = /\blimit\s+\d+/i.test(stripped);
  if (!hasLimit) {
    safeSql = `${sql}\nLIMIT ${maxRows}`;
    warnings.push(`No LIMIT present — capped to ${maxRows} rows.`);
  }

  return { ok: errors.length === 0, errors, warnings, safeSql };
}

/** Naive table-reference extractor from FROM / JOIN clauses (post-strip). */
function extractTableRefs(stripped: string): string[] {
  const refs = new Set<string>();
  const re = /\b(?:from|join)\s+([a-z_][\w.]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    const name = m[1];
    // skip subquery alias "from (" handled because regex requires an identifier
    if (name && !/^select$/i.test(name)) refs.add(name);
  }
  return [...refs];
}

export const SQL_SAFETY = { FORBIDDEN_KEYWORDS, FORBIDDEN_FUNCTIONS, SENSITIVE_COLUMN_PATTERNS, DEFAULT_LIMIT };
