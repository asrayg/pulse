"use client";
import * as React from "react";
import Link from "next/link";
import { RefreshCw, MessageSquarePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TileCard, type TileData } from "./tile-card";

export function DashboardView({ dashboard, tiles: initialTiles }: { dashboard: { id: string; title: string; description: string | null; summary: string | null }; tiles: TileData[] }) {
  const [tiles, setTiles] = React.useState(initialTiles);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const kpis = tiles.filter((t) => t.tileType === "kpi");
  const charts = tiles.filter((t) => t.tileType !== "kpi");

  async function remove(id: string) {
    setTiles((t) => t.filter((x) => x.id !== id));
    await fetch(`/api/dashboards/${dashboard.id}/tiles?tileId=${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{dashboard.title}</h1>
          {dashboard.description && <p className="mt-0.5 text-sm text-muted-foreground">{dashboard.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRefreshKey((k) => k + 1)}><RefreshCw className="size-3.5" /> Refresh</Button>
          <Button asChild size="sm"><Link href="/ask"><MessageSquarePlus className="size-3.5" /> Ask follow-up</Link></Button>
        </div>
      </div>

      <div className="space-y-5 p-6">
        {dashboard.summary && (
          <div className="flex gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <div className="text-xs font-medium text-primary">Executive summary</div>
              <p className="mt-0.5 text-sm text-foreground/90">{dashboard.summary}</p>
            </div>
          </div>
        )}

        {kpis.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((t) => <TileCard key={t.id} tile={t} refreshKey={refreshKey} onDelete={remove} />)}
          </div>
        )}

        {charts.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {charts.map((t) => <TileCard key={t.id} tile={t} refreshKey={refreshKey} onDelete={remove} />)}
          </div>
        )}

        {tiles.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-strong/60 px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">No tiles yet. Ask a question and use “Add to dashboard”.</p>
          </div>
        )}
      </div>
    </div>
  );
}
