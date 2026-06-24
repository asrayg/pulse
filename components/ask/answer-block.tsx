"use client";
import * as React from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import type { AgentAnswer } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { DataTable } from "@/components/data-table/data-table";
import { cn } from "@/lib/utils";

const confColor = { high: "success", medium: "warning", low: "danger" } as const;

export function AnswerBlock({ answer, onFollowUp }: { answer: AgentAnswer; onFollowUp: (q: string) => void }) {
  const [showTable, setShowTable] = React.useState(answer.chart?.type === "table");
  const hasRows = !!answer.result?.rowCount;

  return (
    <div className="animate-fade-up space-y-3">
      {/* Direct answer */}
      <div className="flex gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[15px] font-medium leading-snug text-foreground">{answer.answer}</p>
          {answer.explanation && <p className="text-sm leading-relaxed text-muted-foreground">{answer.explanation}</p>}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge variant={confColor[answer.confidence]}>{answer.confidence} confidence</Badge>
            {answer.intent && <Badge variant="muted">{answer.intent.replace(/_/g, " ")}</Badge>}
            {answer.usedLLM === false && <Badge variant="outline">deterministic</Badge>}
            {answer.result && <Badge variant="outline">{answer.result.rowCount} rows · {answer.result.executionTimeMs}ms</Badge>}
          </div>
        </div>
      </div>

      {answer.error && (
        <Card className="border-danger/30 bg-danger/5 p-3 text-sm text-danger">{answer.error}</Card>
      )}

      {/* Chart */}
      {answer.chart && answer.chart.type !== "table" && hasRows && (
        <Card className="p-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{answer.chart.title}</div>
          <ChartRenderer chart={answer.chart} result={answer.result!} />
        </Card>
      )}

      {/* Data table (collapsible) */}
      {hasRows && (
        <div>
          <button
            onClick={() => setShowTable((s) => !s)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showTable ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {showTable ? "Hide" : "Show"} data ({answer.result!.rowCount} rows)
          </button>
          {showTable && <div className="mt-2"><DataTable result={answer.result!} /></div>}
        </div>
      )}

      {/* Extras (root-cause segment tables) */}
      {answer.extras?.map((ex, i) => (
        <Card key={i} className="p-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{ex.title}</div>
          {ex.result && ex.result.rowCount > 0 ? (
            ex.chart && ex.chart.type !== "table" ? (
              <ChartRenderer chart={ex.chart} result={ex.result} height={220} />
            ) : (
              <DataTable result={ex.result} maxHeight={260} />
            )
          ) : (
            ex.text && <p className="text-sm text-muted-foreground">{ex.text}</p>
          )}
        </Card>
      ))}

      {/* Follow-ups */}
      {answer.followUps?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {answer.followUps.map((q, i) => (
            <button
              key={i}
              onClick={() => onFollowUp(q)}
              className={cn("rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground")}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
