"use client";
import * as React from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { ChartConfig, QueryResult } from "@/lib/types";
import { formatNumber, formatFull, cn } from "@/lib/utils";
import { DataTable } from "@/components/data-table/data-table";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function fmt(v: unknown, format?: ChartConfig["format"]) {
  if (typeof v !== "number") return String(v ?? "—");
  if (format === "currency") return formatNumber(v, { currency: true });
  if (format === "percent") return `${v.toFixed(1)}%`;
  return formatNumber(v);
}

function CustomTooltip({ active, payload, label, format }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border-strong bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}:</span>
          <span className="font-medium text-foreground">{typeof p.value === "number" ? (format === "currency" ? formatFull(p.value, true) : formatFull(p.value)) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

export function ChartRenderer({ chart, result, height = 280, className }: { chart: ChartConfig; result: QueryResult; height?: number; className?: string }) {
  const rows = result?.rows ?? [];

  if (chart.type === "table" || !rows.length) {
    return <DataTable result={result} className={className} />;
  }

  if (chart.type === "kpi") {
    const field = chart.valueField ?? result.columns[0];
    const value = rows[0]?.[field];
    return (
      <div className={cn("flex flex-col justify-center py-2", className)}>
        <div className="text-3xl font-semibold tracking-tight tabular-nums">
          {typeof value === "number" ? fmt(value, chart.format) : String(value ?? "—")}
        </div>
        {chart.description && <div className="mt-1 text-xs text-muted-foreground">{chart.description}</div>}
      </div>
    );
  }

  const ys = Array.isArray(chart.y) ? chart.y : chart.y ? [chart.y] : [];
  const x = chart.x ?? result.columns[0];

  // Pivot for multi-series line/bar when a `series` field is set.
  let data = rows as any[];
  let seriesKeys = ys;
  if (chart.series && ys.length === 1) {
    const yField = ys[0];
    const pivot = new Map<string, any>();
    const keys = new Set<string>();
    for (const r of rows) {
      const xv = String(r[x]);
      const sv = String(r[chart.series]);
      keys.add(sv);
      if (!pivot.has(xv)) pivot.set(xv, { [x]: r[x] });
      pivot.get(xv)[sv] = r[yField];
    }
    data = [...pivot.values()];
    seriesKeys = [...keys];
  }

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <Tooltip content={<CustomTooltip format={chart.format} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
      {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={height} className={className}>
      {chart.type === "line" ? (
        <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <XAxis dataKey={x} tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmt(v, chart.format)} />
          {common}
          {seriesKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      ) : chart.type === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <defs>
            {seriesKeys.map((k, i) => (
              <linearGradient key={k} id={`g-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey={x} tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmt(v, chart.format)} />
          {common}
          {seriesKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} fill={`url(#g-${i})`} />
          ))}
        </AreaChart>
      ) : chart.type === "horizontal_bar" ? (
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v, chart.format)} />
          <YAxis type="category" dataKey={x} tick={axisStyle} tickLine={false} axisLine={false} width={120} />
          {common}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
          ))}
        </BarChart>
      ) : chart.type === "bar" || chart.type === "stacked_bar" ? (
        <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <XAxis dataKey={x} tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmt(v, chart.format)} />
          {common}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId={chart.type === "stacked_bar" ? "a" : undefined} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      ) : chart.type === "pie" || chart.type === "donut" ? (
        <PieChart>
          <Pie data={data} dataKey={ys[0] ?? result.columns[1]} nameKey={x} cx="50%" cy="50%" innerRadius={chart.type === "donut" ? 60 : 0} outerRadius={100} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip format={chart.format} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      ) : (
        <ScatterChart margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <XAxis type="number" dataKey={x} tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--border)" }} name={x} />
          <YAxis type="number" dataKey={ys[0]} tick={axisStyle} tickLine={false} axisLine={false} width={48} name={ys[0]} />
          {common}
          <Scatter data={data} fill={COLORS[0]} />
        </ScatterChart>
      )}
    </ResponsiveContainer>
  );
}
