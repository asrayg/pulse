"use client";
import * as React from "react";
import type { QueryResult } from "@/lib/types";
import { cn, formatFull } from "@/lib/utils";

/** Lightweight, dependency-free data table for SQL results. */
export function DataTable({ result, className, maxHeight = 360 }: { result: QueryResult; className?: string; maxHeight?: number }) {
  const [sort, setSort] = React.useState<{ col: string; dir: 1 | -1 } | null>(null);
  if (!result || !result.columns.length) {
    return <div className="px-4 py-8 text-center text-xs text-muted-foreground">No data.</div>;
  }

  const rows = React.useMemo(() => {
    if (!sort) return result.rows;
    const sorted = [...result.rows].sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv)) * sort.dir;
    });
    return sorted;
  }, [result.rows, sort]);

  function toggleSort(col: string) {
    setSort((s) => (s?.col === col ? { col, dir: s.dir === 1 ? -1 : 1 } : { col, dir: 1 }));
  }

  const isNumeric = (col: string) => result.rows.every((r) => r[col] === null || typeof r[col] === "number");

  return (
    <div className={cn("overflow-auto rounded-md border border-border", className)} style={{ maxHeight }}>
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            {result.columns.map((c) => (
              <th
                key={c}
                onClick={() => toggleSort(c)}
                className={cn(
                  "cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-2 font-medium text-muted-foreground hover:text-foreground",
                  isNumeric(c) ? "text-right" : "text-left",
                )}
              >
                {c}
                {sort?.col === c && <span className="ml-1 text-primary">{sort.dir === 1 ? "↑" : "↓"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
              {result.columns.map((c) => {
                const v = r[c];
                return (
                  <td key={c} className={cn("whitespace-nowrap px-3 py-1.5 tabular-nums", typeof v === "number" ? "text-right text-foreground" : "text-left text-muted-foreground")}>
                    {v === null || v === undefined ? <span className="text-border-strong">—</span> : typeof v === "number" ? formatFull(v) : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {result.truncated && (
        <div className="border-t border-border bg-surface px-3 py-1.5 text-[11px] text-muted-foreground">
          Showing first {result.rowCount} rows.
        </div>
      )}
    </div>
  );
}
