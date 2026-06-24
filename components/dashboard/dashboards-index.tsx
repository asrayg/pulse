"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { timeAgo } from "@/lib/utils";

interface Dash { id: string; title: string; description: string | null; tileCount: number; updatedAt: string | null }

export function DashboardsIndex({ dashboards }: { dashboards: Dash[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    const res = await fetch("/api/dashboards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const data = await res.json();
    setBusy(false);
    setOpen(false);
    router.push(`/dashboards/${data.dashboard.id}`);
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboards</h1>
          <p className="text-sm text-muted-foreground">Saved answers with live data. Each one explains itself.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> New dashboard</Button>
      </div>

      {dashboards.length === 0 ? (
        <EmptyState icon={<LayoutDashboard className="size-5" />} title="No dashboards yet" description="Ask Pulse a question and add it to a dashboard, or create one from scratch." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> New dashboard</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <Link key={d.id} href={`/dashboards/${d.id}`}>
              <Card className="flex h-full flex-col p-4 transition-colors hover:border-border-strong">
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary"><LayoutDashboard className="size-4" /></div>
                  <Badge variant="muted">{d.tileCount} tiles</Badge>
                </div>
                <div className="mt-3 font-medium">{d.title}</div>
                {d.description && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.description}</div>}
                <div className="mt-auto pt-3 text-[11px] text-muted-foreground">Updated {timeAgo(d.updatedAt ?? Date.now())}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New dashboard">
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly Exec Review" autoFocus onKeyDown={(e) => e.key === "Enter" && create()} /></div>
          <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" onClick={create} disabled={busy}>{busy ? <Spinner /> : "Create"}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
