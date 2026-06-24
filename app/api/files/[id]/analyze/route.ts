import { requireCtx, fail, json, route, getDataSource } from "@/lib/api";
import { getAdapter } from "@/lib/adapters";
import type { DbAdapter, SchemaColumn, SemanticType } from "@/lib/types";

interface ColumnProfile {
  name: string;
  dataType: string;
  semanticType?: SemanticType;
  nullCount: number;
  nullPct: number;
  distinctCount: number;
  min?: number;
  max?: number;
  avg?: number;
  outlierCount?: number;
}

interface Profile {
  table: string;
  rowCount: number;
  columns: ColumnProfile[];
  findings: string[];
}

/** Numeric SQLite affinities we profile with min/max/avg/outliers. */
function isNumericType(dataType: string): boolean {
  const t = (dataType || "").toUpperCase();
  return t.includes("INT") || t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB") || t.includes("NUMERIC") || t.includes("DECIMAL");
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function scalar(adapter: DbAdapter, sql: string): Promise<unknown> {
  const res = await adapter.run(sql, { maxRows: 1 });
  if (!res.rows.length) return null;
  const row = res.rows[0];
  const keys = Object.keys(row);
  return keys.length ? row[keys[0]] : null;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;

    const ds = getDataSource(ctx.workspaceId, id);
    if (!ds) return fail("Data source not found.", 404);
    if (ds.type !== "csv") return fail("Analysis is only available for uploaded CSV sources.");

    const adapter = getAdapter(ds);
    const schemaInfo = await adapter.introspect();
    const tbl = schemaInfo.tables[0];
    if (!tbl) return fail("No table found in this data source.", 404);

    const table = tbl.name;
    const cols: SchemaColumn[] = tbl.columns;

    const rowCountRaw = await scalar(adapter, `SELECT COUNT(*) AS c FROM "${table}"`);
    const rowCount = num(rowCountRaw) ?? 0;

    const columns: ColumnProfile[] = [];
    const findings: string[] = [];

    for (const col of cols) {
      const c = col.name;
      const qc = `"${c}"`;

      const nullCount = num(await scalar(adapter, `SELECT COUNT(*) AS c FROM "${table}" WHERE ${qc} IS NULL`)) ?? 0;
      const distinctCount = num(await scalar(adapter, `SELECT COUNT(DISTINCT ${qc}) AS c FROM "${table}"`)) ?? 0;
      const nullPct = rowCount > 0 ? Math.round((nullCount / rowCount) * 1000) / 10 : 0;

      const profile: ColumnProfile = {
        name: c,
        dataType: col.dataType,
        semanticType: col.semanticType,
        nullCount,
        nullPct,
        distinctCount,
      };

      if (isNumericType(col.dataType)) {
        const aggRes = await adapter.run(
          `SELECT MIN(${qc}) AS mn, MAX(${qc}) AS mx, AVG(${qc}) AS av FROM "${table}" WHERE ${qc} IS NOT NULL`,
          { maxRows: 1 },
        );
        const agg = aggRes.rows[0] ?? {};
        const mn = num(agg.mn);
        const mx = num(agg.mx);
        const av = num(agg.av);
        if (mn !== undefined) profile.min = mn;
        if (mx !== undefined) profile.max = mx;
        if (av !== undefined) profile.avg = Math.round(av * 1000) / 1000;

        // Rough outlier band: values outside avg +/- 3 * ((max-min)/6).
        // (max-min)/6 approximates a standard deviation for a roughly normal
        // spread, avoiding SQLite's missing STDDEV. Read-only via subqueries.
        if (mn !== undefined && mx !== undefined && mx > mn) {
          const outlierCount =
            num(
              await scalar(
                adapter,
                `SELECT COUNT(*) AS c FROM "${table}" WHERE ${qc} IS NOT NULL AND (` +
                  `${qc} < (SELECT AVG(${qc}) FROM "${table}") - (SELECT 3.0*(MAX(${qc})-MIN(${qc}))/6.0 FROM "${table}") OR ` +
                  `${qc} > (SELECT AVG(${qc}) FROM "${table}") + (SELECT 3.0*(MAX(${qc})-MIN(${qc}))/6.0 FROM "${table}"))`,
              ),
            ) ?? 0;
          profile.outlierCount = outlierCount;
          if (outlierCount > 0) {
            findings.push(
              `Column "${c}" has ${outlierCount} potential outlier${outlierCount === 1 ? "" : "s"} far from the mean (${profile.avg}).`,
            );
          }
        } else {
          profile.outlierCount = 0;
        }
      }

      columns.push(profile);

      // Findings: high-null and low-cardinality columns.
      if (rowCount > 0 && nullPct >= 50) {
        findings.push(`Column "${c}" is ${nullPct}% null — it may be sparsely populated or unused.`);
      } else if (rowCount > 0 && nullCount > 0 && nullPct >= 20) {
        findings.push(`Column "${c}" has ${nullPct}% missing values.`);
      }

      if (rowCount >= 10) {
        if (distinctCount === 1) {
          findings.push(`Column "${c}" is constant — every row shares a single value.`);
        } else if (distinctCount > 1 && distinctCount <= Math.max(2, Math.floor(rowCount * 0.02))) {
          findings.push(`Column "${c}" is low-cardinality (${distinctCount} distinct values) — a good candidate for grouping.`);
        } else if (distinctCount === rowCount) {
          findings.push(`Column "${c}" is unique across all ${rowCount} rows — likely an identifier.`);
        }
      }
    }

    if (rowCount === 0) findings.push("The table contains no rows.");
    if (findings.length === 0) findings.push("No notable data-quality issues detected.");

    const profile: Profile = { table, rowCount, columns, findings };
    return json({ profile });
  });
}
