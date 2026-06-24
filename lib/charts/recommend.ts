import type { ChartConfig, QueryResult, ChartType } from "@/lib/types";

/**
 * Pick a sensible chart for a result set when the agent didn't specify one,
 * or to sanity-check the agent's choice against the actual columns returned.
 */
export function recommendChart(result: QueryResult, title = "Result"): ChartConfig {
  const { columns, rows } = result;
  if (!rows.length || columns.length === 0) {
    return { type: "table", title };
  }

  const sample = rows[0];
  const numeric = columns.filter((c) => rows.every((r) => r[c] === null || typeof r[c] === "number"));
  const nonNumeric = columns.filter((c) => !numeric.includes(c));
  const dateCols = columns.filter((c) => isDateColumn(c, rows));
  const categorical = nonNumeric.filter((c) => !dateCols.includes(c));

  // Single scalar → KPI
  if (rows.length === 1 && numeric.length >= 1 && columns.length <= 2) {
    const valueField = numeric[0];
    return {
      type: "kpi",
      title,
      valueField,
      format: guessFormat(valueField, sample[valueField]),
    };
  }

  // Time series → line
  if (dateCols.length >= 1 && numeric.length >= 1) {
    const x = dateCols[0];
    const ys = numeric.filter((n) => n !== x);
    const series = categorical.length === 1 && rows.length > ys.length ? categorical[0] : undefined;
    return {
      type: "line",
      title,
      x,
      y: series ? ys[0] : ys.slice(0, 4),
      series,
      format: guessFormat(ys[0], sample[ys[0]]),
    };
  }

  // Category vs single numeric → bar (horizontal if labels long / many rows)
  if (categorical.length >= 1 && numeric.length >= 1) {
    const x = categorical[0];
    const y = numeric[0];
    const longLabels = rows.some((r) => String(r[x] ?? "").length > 14) || rows.length > 8;
    return {
      type: longLabels ? "horizontal_bar" : "bar",
      title,
      x,
      y,
      format: guessFormat(y, sample[y]),
    };
  }

  // Two numerics → scatter
  if (numeric.length >= 2 && !dateCols.length) {
    return { type: "scatter", title, x: numeric[0], y: numeric[1] };
  }

  return { type: "table", title };
}

function isDateColumn(col: string, rows: QueryResult["rows"]): boolean {
  if (/date|month|week|day|year|_at$|time|period|quarter/i.test(col)) return true;
  const vals = rows.map((r) => r[col]).filter((v) => v != null);
  if (!vals.length) return false;
  return vals.every((v) => typeof v === "string" && /^\d{4}-\d{2}/.test(v));
}

function guessFormat(col: string, sampleValue: unknown): ChartConfig["format"] {
  if (/amount|revenue|mrr|arr|price|cost|total|value|spend|salary/i.test(col)) return "currency";
  if (/rate|pct|percent|ratio|conversion/i.test(col)) return "percent";
  if (typeof sampleValue === "number") return "number";
  return "number";
}

/** Normalize/repair an agent-provided chart config against the real columns. */
export function reconcileChart(
  proposed: ChartConfig | null | undefined,
  result: QueryResult,
  title: string,
): ChartConfig {
  if (!proposed) return recommendChart(result, title);
  const cols = new Set(result.columns);
  const valid =
    (!proposed.x || cols.has(proposed.x)) &&
    (!proposed.y ||
      (Array.isArray(proposed.y) ? proposed.y.every((y) => cols.has(y)) : cols.has(proposed.y))) &&
    (!proposed.valueField || cols.has(proposed.valueField));
  if (!valid) {
    const fallback = recommendChart(result, proposed.title || title);
    return { ...fallback, title: proposed.title || fallback.title };
  }
  return { ...proposed, title: proposed.title || title };
}

export const CHART_TYPES: ChartType[] = [
  "line", "bar", "horizontal_bar", "area", "stacked_bar", "pie", "donut", "scatter", "kpi", "table",
];
