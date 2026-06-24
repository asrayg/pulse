"use client";
import * as React from "react";
import { Copy, Check, ShieldCheck, AlertTriangle, ListChecks } from "lucide-react";
import type { AgentAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Inspector({ answer }: { answer: AgentAnswer | null }) {
  const [copied, setCopied] = React.useState(false);

  if (!answer) {
    return (
      <div className="p-5 text-xs text-muted-foreground">
        Query details, generated SQL, assumptions, and validation will appear here once you ask a question.
      </div>
    );
  }

  function copy() {
    if (!answer?.sql) return;
    navigator.clipboard.writeText(answer.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5 p-4">
      <Section title="Generated SQL" icon={<ListChecks className="size-3.5" />}>
        {answer.sql ? (
          <div className="relative">
            <button onClick={copy} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Copy SQL">
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </button>
            <pre className="overflow-auto rounded-md border border-border bg-[#08090c] p-3 pr-9 font-mono text-[11px] leading-relaxed text-foreground/90">{answer.sql}</pre>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No SQL was generated.</p>
        )}
      </Section>

      {answer.assumptions?.length > 0 && (
        <Section title="Assumptions">
          <ul className="space-y-1">
            {answer.assumptions.map((a, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-muted-foreground"><span className="text-primary">•</span>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      {answer.validation && (answer.validation.warnings.length > 0 || answer.validation.errors.length > 0) && (
        <Section title="Validation" icon={<ShieldCheck className="size-3.5" />}>
          <div className="space-y-1">
            {answer.validation.errors.map((e, i) => (
              <div key={`e${i}`} className="flex items-start gap-1.5 text-xs text-danger"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{e}</div>
            ))}
            {answer.validation.warnings.map((w, i) => (
              <div key={`w${i}`} className="flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{w}</div>
            ))}
          </div>
        </Section>
      )}

      {answer.dataNotes && answer.dataNotes.length > 0 && (
        <Section title="Data quality">
          <ul className="space-y-1">
            {answer.dataNotes.map((n, i) => (
              <li key={i} className="text-xs text-muted-foreground">{n}</li>
            ))}
          </ul>
        </Section>
      )}

      {answer.trace && answer.trace.length > 0 && (
        <Section title="Pipeline">
          <ol className="space-y-1">
            {answer.trace.map((s, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", s.status === "ok" ? "bg-success" : s.status === "warn" ? "bg-warning" : "bg-danger")} />
                  <span className="text-muted-foreground">{s.step}</span>
                </span>
                {s.durationMs != null && <span className="tabular-nums text-border-strong">{s.durationMs}ms</span>}
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
