"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";

const EXAMPLES = [
  "Why did revenue drop last week?",
  "Show top customers by revenue.",
  "Make a sales dashboard.",
  "Which users are most likely to churn?",
  "Summarize this month's performance.",
];

export function HomeHero({ name }: { name: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const go = (question: string) => router.push(`/ask?q=${encodeURIComponent(question)}`);

  return (
    <div className="pulse-glow rounded-xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="size-3.5" /> Pulse Agent
      </div>
      <h1 className="text-xl font-semibold tracking-tight">Good to see you, {name}.</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ask anything about your business data — I&apos;ll generate the SQL, chart it, and explain what changed.</p>

      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q); }} className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-input px-2 py-1.5 focus-within:border-border-strong">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about your business data..." className="flex-1 bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none" />
        <button type="submit" className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"><ArrowUp className="size-4" /></button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => go(e)} className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">{e}</button>
        ))}
      </div>
    </div>
  );
}
