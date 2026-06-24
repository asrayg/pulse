"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Bell, Trash2, TrendingDown, TrendingUp, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cn, formatNumber } from "@/lib/utils";

interface AlertRow {
  id: string;
  name: string;
  conditionJson: string | null;
  scheduleCron: string | null;
  notificationTarget: string | null;
  enabled: boolean;
  lastStatus: string | null;
  lastCheckedAt: string | null;
}

interface Condition {
  op: "<" | ">";
  threshold: number;
}

const SCHEDULES: { value: string; label: string }[] = [
  { value: "0 8 * * *", label: "Daily at 8am" },
  { value: "0 * * * *", label: "Hourly" },
  { value: "0 8 * * 1", label: "Weekly (Mon 8am)" },
];

const EXAMPLE_SQL =
  "SELECT ROUND(SUM(amount),2) AS value FROM invoices WHERE status='paid' AND paid_at>=date('now','-1 day')";

function parseCondition(raw: string | null): Condition | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<Condition>;
    if ((c.op === "<" || c.op === ">") && typeof c.threshold === "number") {
      return { op: c.op, threshold: c.threshold };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function conditionSummary(raw: string | null): string {
  const c = parseCondition(raw);
  if (!c) return "No condition set";
  const dir = c.op === "<" ? "below" : "above";
  return `Triggers when value is ${dir} ${formatNumber(c.threshold)}`;
}

function scheduleLabel(cron: string | null): string {
  if (!cron) return "Not scheduled";
  return SCHEDULES.find((s) => s.value === cron)?.label ?? cron;
}

function styledSelectClass() {
  return "flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50";
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function AlertsIndex({ alerts, dataSourceId }: { alerts: AlertRow[]; dataSourceId: string | null }) {
  const router = useRouter();
  const [items, setItems] = React.useState<AlertRow[]>(alerts);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pending, setPending] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setItems(alerts);
  }, [alerts]);

  // Create form state
  const [name, setName] = React.useState("");
  const [op, setOp] = React.useState<"<" | ">">("<");
  const [threshold, setThreshold] = React.useState("5000");
  const [sql, setSql] = React.useState(EXAMPLE_SQL);
  const [schedule, setSchedule] = React.useState(SCHEDULES[0].value);
  const [target, setTarget] = React.useState("");

  function resetForm() {
    setName("");
    setOp("<");
    setThreshold("5000");
    setSql(EXAMPLE_SQL);
    setSchedule(SCHEDULES[0].value);
    setTarget("");
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const condition: Condition = { op, threshold: Number(threshold) || 0 };
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        condition,
        generatedSql: sql.trim() || null,
        scheduleCron: schedule,
        notificationTarget: target.trim() || null,
        dataSourceId,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      resetForm();
      router.refresh();
    }
  }

  async function toggle(a: AlertRow) {
    const next = !a.enabled;
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled: next } : x)));
    setPending((p) => ({ ...p, [a.id]: true }));
    const res = await fetch(`/api/alerts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setPending((p) => ({ ...p, [a.id]: false }));
    if (!res.ok) {
      // revert on failure, then re-sync from server
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled: a.enabled } : x)));
    }
    router.refresh();
  }

  async function remove(a: AlertRow) {
    setItems((prev) => prev.filter((x) => x.id !== a.id));
    setPending((p) => ({ ...p, [a.id]: true }));
    const res = await fetch(`/api/alerts/${a.id}`, { method: "DELETE" });
    setPending((p) => ({ ...p, [a.id]: false }));
    if (!res.ok) {
      setItems((prev) => [...prev, a]);
    }
    router.refresh();
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground">Get notified when a metric breaks.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New alert
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="No alerts yet"
          description="Create an alert to get notified when a metric crosses a threshold you care about."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New alert
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const cond = parseCondition(a.conditionJson);
            return (
              <Card key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                      {cond?.op === ">" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{a.name}</span>
                        <Badge variant={a.enabled ? "success" : "muted"}>{a.enabled ? "Enabled" : "Disabled"}</Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{conditionSummary(a.conditionJson)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" /> {scheduleLabel(a.scheduleCron)}
                    </span>
                    {a.notificationTarget && (
                      <span className="inline-flex items-center gap-1">
                        <Send className="size-3.5" /> {a.notificationTarget}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-11 sm:pl-0">
                  <Switch checked={a.enabled} onChange={() => toggle(a)} disabled={pending[a.id]} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(a)}
                    disabled={pending[a.id]}
                    aria-label="Delete alert"
                    className="text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New alert">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Paid revenue dropped"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <select
                className={styledSelectClass()}
                value={op}
                onChange={(e) => setOp(e.target.value as "<" | ">")}
              >
                <option value="<">Below</option>
                <option value=">">Above</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Threshold</Label>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="5000"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Query (optional)</Label>
            <Textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder={EXAMPLE_SQL}
            />
            <p className="text-[11px] text-muted-foreground">
              A SELECT returning a single numeric column named <code>value</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Schedule</Label>
            <select
              className={styledSelectClass()}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            >
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Notify</Label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="you@company.com or #alerts"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={create} disabled={busy || !name.trim()}>
              {busy ? <Spinner /> : "Create alert"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
