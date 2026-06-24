import type { QueryResult } from "@/lib/types";

/** Step 7: inspect a result for data-quality red flags. */
export function inspectResult(result: QueryResult): { notes: string[]; suspicious: boolean } {
  const notes: string[] = [];
  let suspicious = false;

  if (result.rowCount === 0) {
    notes.push("Query returned no rows — the filters may be too narrow or the period may have no data.");
    suspicious = true;
    return { notes, suspicious };
  }

  if (result.truncated) {
    notes.push(`Result was truncated to ${result.rowCount} rows; consider aggregating further.`);
  }

  // null-heavy columns
  for (const col of result.columns) {
    const nulls = result.rows.filter((r) => r[col] === null || r[col] === "").length;
    const ratio = nulls / result.rows.length;
    if (ratio > 0.5 && result.rows.length >= 4) {
      notes.push(`Column "${col}" is ${Math.round(ratio * 100)}% null/empty.`);
    }
  }

  // suspicious single-row zero
  if (result.rowCount === 1) {
    const vals = Object.values(result.rows[0]);
    if (vals.length === 1 && (vals[0] === 0 || vals[0] === null)) {
      notes.push("The single aggregate value is zero/null — verify the metric definition and date filter.");
      suspicious = true;
    }
  }

  return { notes, suspicious };
}
