"use client";
import * as React from "react";
import Link from "next/link";
import { Search, History, Copy, Check, ChevronRight, ArrowUpRight, RotateCw, AlertTriangle } from "lucide-react";
import type { QueryResult, SqlRow } from "@/lib/types";
import { cn, timeAgo, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, EmptyState, Separator } from "@/components/ui/misc";
import { DataTable } from "@/components/data-table/data-table";

export interface HistoryRun {
  id: string;
  questionText: string;
  generatedSql: string | null;
  status: string | null;
  errorMessage: string | null;
  rowCount: number | null;
  executionTimeMs: number | null;
  confidence: string | null;
  intent: string | null;
  createdAt: string | null;
  resultPreviewJson: string | null;
  assumptionsJson: string | null;
}

function parsePreview(raw: string | null): QueryResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const columns = Array.isArray(obj.columns) ? (obj.columns as unknown[]).map(String) : null;
    const rows = Array.isArray(obj.rows) ? (obj.rows as SqlRow[]) : null;
    if (!columns || !rows) return null;
    return {
      columns,
      rows,
      rowCount: typeof obj.rowCount === "number" ? obj.rowCount : rows.length,
      executionTimeMs: typeof obj.executionTimeMs === "number" ? obj.executionTimeMs : 0,
      truncated: obj.truncated === true,
    };
  } catch {
    return null;
  }
}

function parseAssumptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function confidenceVariant(c: string | null): "success" | "warning" | "danger" | "muted" {
  if (c === "high") return "success";
  if (c === "medium") return "warning";
  if (c === "low") return "danger";
  return "muted";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function RunRow({ run }: { run: HistoryRun }) {
  const [open, setOpen] = React.useState(false);
  const isError = run.status === "error";
  const preview = React.useMemo(() => parsePreview(run.resultPreviewJson), [run.resultPreviewJson]);
  const assumptions = React.useMemo(() => parseAssumptions(run.assumptionsJson), [run.assumptionsJson]);
  const askHref = `/ask?q=${encodeURIComponent(run.questionText)}`;

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", isError ? "bg-danger" : "bg-success")}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{run.questionText}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {run.intent && <Badge variant="outline">{run.intent.replace(/_/g, " ")}</Badge>}
            {run.confidence && <Badge variant={confidenceVariant(run.confidence)}>{run.confidence}</Badge>}
            {run.rowCount != null && (
              <Badge variant="muted">{formatNumber(run.rowCount)} rows</Badge>
            )}
            {run.executionTimeMs != null && (
              <Badge variant="muted">{formatNumber(run.executionTimeMs)} ms</Badge>
            )}
            {isError && (
              <Badge variant="danger">
                <AlertTriangle className="size-3" />
                error
              </Badge>
            )}
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {run.createdAt ? timeAgo(new Date(run.createdAt)) : "—"}
        </span>
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border bg-surface/40 px-4 py-4">
          {isError && run.errorMessage && (
            <div className="rounded-md border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
              {run.errorMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={askHref}>
                <RotateCw className="size-3.5" />
                Re-run
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={askHref}>
                Open in Ask
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          {run.generatedSql && (
            <div className="rounded-md border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Generated SQL
                </span>
                <CopyButton text={run.generatedSql} />
              </div>
              <pre className="overflow-auto px-3 py-2 text-xs leading-relaxed text-foreground">
                <code className="font-mono">{run.generatedSql}</code>
              </pre>
            </div>
          )}

          {assumptions.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Assumptions
              </p>
              <ul className="space-y-1">
                {assumptions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-border-strong" aria-hidden />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview && preview.columns.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Result preview
              </p>
              <DataTable result={preview} maxHeight={280} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryIndex({ runs }: { runs: HistoryRun[] }) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => r.questionText.toLowerCase().includes(q));
  }, [runs, query]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Query History"
        description="Every question Pulse has answered — fully reproducible."
      />

      <div className="px-6 py-6">
        {runs.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title="No queries yet"
            description="Ask Pulse a question and it will show up here — with the SQL, assumptions, and results saved for replay."
            action={
              <Button asChild size="sm">
                <Link href="/ask">Ask a question</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions…"
                className="pl-9"
              />
            </div>

            <Separator />

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No questions match “{query}”.
                </div>
              ) : (
                filtered.map((run) => <RunRow key={run.id} run={run} />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
