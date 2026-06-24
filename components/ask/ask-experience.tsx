"use client";
import * as React from "react";
import { ArrowUp, Save, LayoutDashboard, Bell, Download, RefreshCw, Wand2, Database } from "lucide-react";
import type { AgentAnswer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { AnswerBlock } from "./answer-block";
import { Inspector } from "./inspector";

interface DataSourceLite { id: string; name: string; type: string }
interface Turn { question: string; answer: AgentAnswer | null; loading: boolean }

const STEPS = ["Understanding question", "Inspecting schema", "Generating SQL", "Validating safety", "Running query", "Explaining results"];

export function AskExperience({
  dataSources,
  suggestions,
  initialQuestion,
}: {
  dataSources: DataSourceLite[];
  suggestions: string[];
  initialQuestion?: string;
}) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [dsId, setDsId] = React.useState(dataSources[0]?.id ?? "");
  const [stepIdx, setStepIdx] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const active = turns[turns.length - 1]?.answer ?? null;
  const busy = turns.some((t) => t.loading);

  const ask = React.useCallback(
    async (question: string) => {
      if (!question.trim() || busy) return;
      setInput("");
      setTurns((t) => [...t, { question, answer: null, loading: true }]);
      setStepIdx(0);
      const ticker = setInterval(() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)), 700);
      try {
        const res = await fetch("/api/agent/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, dataSourceId: dsId }),
        });
        const data = await res.json();
        const answer: AgentAnswer = data.answer ?? { question, answer: data.error ?? "Something went wrong.", error: data.error, assumptions: [], confidence: "low", followUps: [], intent: "general_help" };
        setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer, loading: false } : x)));
      } catch (e) {
        setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer: { question, answer: (e as Error).message, error: (e as Error).message, assumptions: [], confidence: "low", followUps: [], intent: "general_help" }, loading: false } : x)));
      } finally {
        clearInterval(ticker);
      }
    },
    [busy, dsId],
  );

  React.useEffect(() => {
    if (initialQuestion) ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const empty = turns.length === 0;

  return (
    <div className="flex h-full">
      {/* Conversation column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {empty ? (
            <Hero suggestions={suggestions} onPick={ask} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
              {turns.map((turn, i) => (
                <div key={i} className="space-y-4">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-surface-2 px-4 py-2.5 text-sm">{turn.question}</div>
                  </div>
                  {turn.loading ? (
                    <LoadingSteps stepIdx={stepIdx} />
                  ) : (
                    turn.answer && (
                      <>
                        <AnswerBlock answer={turn.answer} onFollowUp={ask} />
                        {i === turns.length - 1 && <ActionBar answer={turn.answer} dsId={dsId} onRegenerate={() => ask(turn.question)} onFix={() => ask(`${turn.question} — the previous result looked off, please reconsider the metric definition and date filters.`)} />}
                      </>
                    )
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-surface/40 px-6 py-4">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 shadow-lg focus-within:border-border-strong"
          >
            {dataSources.length > 1 && (
              <select value={dsId} onChange={(e) => setDsId(e.target.value)} className="rounded-md border border-border bg-input px-2 py-1.5 text-xs text-muted-foreground focus:outline-none">
                {dataSources.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your business data..."
              className="flex-1 bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} className="rounded-lg">
              {busy ? <Spinner /> : <ArrowUp className="size-4" />}
            </Button>
          </form>
        </div>
      </div>

      {/* Inspector panel */}
      <div className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-border bg-surface/30 lg:block">
        <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Query details</div>
        <Inspector answer={active} />
      </div>
    </div>
  );
}

function Hero({ suggestions, onPick }: { suggestions: string[]; onPick: (q: string) => void }) {
  return (
    <div className="pulse-glow relative flex h-full flex-col items-center justify-center px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ask your data anything</h1>
        <p className="mt-2 text-sm text-muted-foreground">Plain-English questions in. Charts, SQL, and explanations out.</p>
      </div>
      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s)}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm transition-all hover:border-primary/40 hover:bg-surface-2"
          >
            <Wand2 className="size-4 shrink-0 text-primary/70 group-hover:text-primary" />
            <span className="text-foreground/90">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingSteps({ stepIdx }: { stepIdx: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2 text-xs">
          {i < stepIdx ? <span className="text-success">✓</span> : i === stepIdx ? <Spinner className="size-3 text-primary" /> : <span className="size-3 rounded-full border border-border" />}
          <span className={i <= stepIdx ? "text-foreground" : "text-muted-foreground"}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function ActionBar({ answer, dsId, onRegenerate, onFix }: { answer: AgentAnswer; dsId: string; onRegenerate: () => void; onFix: () => void }) {
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [dashOpen, setDashOpen] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  function copySql() { if (answer.sql) { navigator.clipboard.writeText(answer.sql); flash("SQL copied"); } }
  function exportCsv() {
    if (!answer.result) return;
    const { columns, rows } = answer.result;
    const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pulse-export.csv";
    a.click();
  }

  if (answer.error) {
    return (
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onRegenerate}><RefreshCw className="size-3.5" /> Try again</Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => setSaveOpen(true)}><Save className="size-3.5" /> Save</Button>
        <Button size="sm" variant="secondary" onClick={() => setDashOpen(true)}><LayoutDashboard className="size-3.5" /> Add to dashboard</Button>
        <Button size="sm" variant="secondary" onClick={() => setAlertOpen(true)}><Bell className="size-3.5" /> Create alert</Button>
        <Button size="sm" variant="ghost" onClick={exportCsv}><Download className="size-3.5" /> CSV</Button>
        <Button size="sm" variant="ghost" onClick={copySql}>Copy SQL</Button>
        <Button size="sm" variant="ghost" onClick={onRegenerate}><RefreshCw className="size-3.5" /> Regenerate</Button>
        <Button size="sm" variant="ghost" onClick={onFix}>Fix result</Button>
      </div>
      {toast && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-md border border-border-strong bg-popover px-3 py-1.5 text-xs shadow-xl">{toast}</div>}

      <SaveQuestionModal open={saveOpen} onClose={() => setSaveOpen(false)} answer={answer} dsId={dsId} onSaved={() => flash("Saved as question")} />
      <AddToDashboardModal open={dashOpen} onClose={() => setDashOpen(false)} answer={answer} dsId={dsId} onAdded={() => flash("Added to dashboard")} />
      <CreateAlertModal open={alertOpen} onClose={() => setAlertOpen(false)} answer={answer} dsId={dsId} onCreated={() => flash("Alert created")} />
    </>
  );
}

function SaveQuestionModal({ open, onClose, answer, dsId, onSaved }: { open: boolean; onClose: () => void; answer: AgentAnswer; dsId: string; onSaved: () => void }) {
  const [title, setTitle] = React.useState(answer.question.slice(0, 60));
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setTitle(answer.question.slice(0, 60)), [answer.question]);
  async function save() {
    setSaving(true);
    await fetch("/api/saved-questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, questionText: answer.question, generatedSql: answer.sql, chartConfig: answer.chart, explanation: answer.explanation, answer, dataSourceId: dsId }) });
    setSaving(false); onClose(); onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title="Save as question">
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={save} disabled={saving}>{saving ? <Spinner /> : "Save"}</Button></div>
      </div>
    </Modal>
  );
}

function AddToDashboardModal({ open, onClose, answer, dsId, onAdded }: { open: boolean; onClose: () => void; answer: AgentAnswer; dsId: string; onAdded: () => void }) {
  const [dashboards, setDashboards] = React.useState<{ id: string; title: string }[]>([]);
  const [target, setTarget] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) fetch("/api/dashboards").then((r) => r.json()).then((d) => { setDashboards(d.dashboards ?? []); setTarget(d.dashboards?.[0]?.id ?? "new"); });
  }, [open]);
  async function add() {
    setBusy(true);
    let dashId = target;
    if (target === "new") {
      const res = await fetch("/api/dashboards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle || "New dashboard" }) });
      dashId = (await res.json()).dashboard.id;
    }
    await fetch(`/api/dashboards/${dashId}/tiles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: answer.chart?.title || answer.question.slice(0, 50), tileType: answer.chart?.type === "kpi" ? "kpi" : answer.chart?.type === "table" ? "table" : "chart", generatedSql: answer.sql, chartConfig: answer.chart, dataSourceId: dsId, explanation: answer.explanation }) });
    setBusy(false); onClose(); onAdded();
  }
  return (
    <Modal open={open} onClose={onClose} title="Add to dashboard">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Dashboard</Label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm">
            {dashboards.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            <option value="new">+ Create new dashboard</option>
          </select>
        </div>
        {target === "new" && <div className="space-y-1.5"><Label>New dashboard name</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Weekly Exec Review" /></div>}
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={add} disabled={busy}>{busy ? <Spinner /> : "Add tile"}</Button></div>
      </div>
    </Modal>
  );
}

function CreateAlertModal({ open, onClose, answer, dsId, onCreated }: { open: boolean; onClose: () => void; answer: AgentAnswer; dsId: string; onCreated: () => void }) {
  const [name, setName] = React.useState(answer.question.slice(0, 50));
  const [op, setOp] = React.useState("<");
  const [threshold, setThreshold] = React.useState("5000");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setName(answer.question.slice(0, 50)), [answer.question]);
  async function create() {
    setBusy(true);
    await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, generatedSql: answer.sql, dataSourceId: dsId, condition: { op, threshold: Number(threshold) }, scheduleCron: "0 8 * * *" }) });
    setBusy(false); onClose(); onCreated();
  }
  return (
    <Modal open={open} onClose={onClose} title="Create alert">
      <div className="space-y-3">
        <div className="space-y-1.5"><Label>Alert name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5"><Label>Condition</Label>
            <div className="flex gap-2">
              <select value={op} onChange={(e) => setOp(e.target.value)} className="h-9 w-20 rounded-md border border-border bg-input px-2 text-sm"><option value="<">below</option><option value=">">above</option></select>
              <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} type="number" />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Checks the query result daily at 8am and notifies when the value is {op === "<" ? "below" : "above"} {threshold}.</p>
        <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" onClick={create} disabled={busy}>{busy ? <Spinner /> : "Create alert"}</Button></div>
      </div>
    </Modal>
  );
}
