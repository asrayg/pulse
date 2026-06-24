import type { SemanticType } from "@/lib/types";

/** Heuristic semantic type inference from column name + sampled values. */
export function inferSemanticType(
  columnName: string,
  dataType: string,
  samples: (string | number | null)[],
): SemanticType {
  const n = columnName.toLowerCase();
  const t = (dataType || "").toLowerCase();
  const nonNull = samples.filter((s) => s !== null && s !== "");

  if (/(^|_)id$|^id$|_id$|uuid|guid/.test(n)) return "id";
  if (/email/.test(n)) return "email";
  if (/(amount|revenue|price|cost|mrr|arr|total|salary|spend|value)/.test(n) && /int|real|num|float|double|decimal|money/.test(t))
    return "currency";
  if (/(rate|pct|percent|ratio|conversion)/.test(n)) return "percentage";
  if (/(date|_at$|time|timestamp|created|updated|closed|started|canceled|resolved)/.test(n)) return "date";
  if (/bool/.test(t) || /(is_|has_|enabled|active$)/.test(n)) return "boolean";

  // value-based
  if (nonNull.length) {
    const allDates = nonNull.every((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v));
    if (allDates) return "date";
    const allNum = nonNull.every((v) => typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)));
    if (allNum) return /int|real|num|float|double|decimal/.test(t) ? "number" : "number";
    // low-cardinality strings → category
    const uniq = new Set(nonNull.map(String));
    if (uniq.size <= Math.max(2, Math.min(20, nonNull.length / 2)) && nonNull.every((v) => typeof v === "string"))
      return "category";
  }
  if (/char|text|string|clob/.test(t)) return "text";
  if (/int|real|num|float|double|decimal/.test(t)) return "number";
  return "text";
}

/** Guess plausible foreign-key relationships from `*_id` columns. */
export function inferRelationships(
  tables: { name: string; columns: { name: string }[] }[],
): { fromTable: string; fromColumn: string; toTable: string; toColumn: string; confidence: number }[] {
  const out: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; confidence: number }[] = [];
  const byName = new Map(tables.map((t) => [t.name.toLowerCase(), t]));
  const singularize = (s: string) => s.replace(/ies$/, "y").replace(/s$/, "");

  for (const t of tables) {
    for (const c of t.columns) {
      const m = c.name.match(/^(.*)_id$/i);
      if (!m) continue;
      const base = m[1].toLowerCase();
      const candidates = [base, base + "s", singularize(base), base + "es"];
      for (const cand of candidates) {
        const target = byName.get(cand);
        if (target && target.name !== t.name && target.columns.some((tc) => tc.name.toLowerCase() === "id")) {
          out.push({ fromTable: t.name, fromColumn: c.name, toTable: target.name, toColumn: "id", confidence: 0.8 });
          break;
        }
      }
    }
  }
  return out;
}
