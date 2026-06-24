"use client";
import * as React from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import type { ChartConfig, QueryResult } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ChartRenderer } from "@/components/charts/chart-renderer";

export interface TileData {
  id: string;
  title: string;
  tileType: string;
  generatedSql: string | null;
  chartConfigJson: string | null;
  dataSourceId: string | null;
  explanation: string | null;
}

export function TileCard({ tile, refreshKey, onDelete }: { tile: TileData; refreshKey: number; onDelete?: (id: string) => void }) {
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState(false);
  const chart: ChartConfig | null = tile.chartConfigJson ? JSON.parse(tile.chartConfigJson) : null;
  const isKpi = tile.tileType === "kpi" || chart?.type === "kpi";

  React.useEffect(() => {
    let alive = true;
    setResult(null);
    setError(null);
    fetch("/api/query/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql: tile.generatedSql, dataSourceId: tile.dataSourceId }) })
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d.error) setError(d.error); else setResult(d.result); } })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [tile.generatedSql, tile.dataSourceId, refreshKey]);

  return (
    <Card className={`group relative flex flex-col ${isKpi ? "" : "min-h-[260px]"}`}>
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="text-xs font-medium text-muted-foreground">{tile.title}</div>
        {onDelete && (
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"><MoreVertical className="size-3.5" /></button>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-32 rounded-md border border-border bg-popover p-1 shadow-xl">
                <button onClick={() => { onDelete(tile.id); setMenu(false); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-danger hover:bg-muted"><Trash2 className="size-3.5" /> Remove</button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-1">
        {error ? (
          <div className="flex flex-1 items-center justify-center text-xs text-danger">{error}</div>
        ) : !result ? (
          <div className="space-y-2 pt-2">{isKpi ? <Skeleton className="h-9 w-24" /> : <><Skeleton className="h-40 w-full" /></>}</div>
        ) : isKpi && chart ? (
          <ChartRenderer chart={chart} result={result} />
        ) : chart ? (
          <ChartRenderer chart={chart} result={result} height={200} />
        ) : null}
        {tile.explanation && !isKpi && <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{tile.explanation}</p>}
      </div>
    </Card>
  );
}
