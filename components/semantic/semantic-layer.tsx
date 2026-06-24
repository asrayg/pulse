"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Sigma, Tags, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, Spinner, Separator } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cn, timeAgo } from "@/lib/utils";

interface Metric {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  sqlExpression: string;
  baseTable: string | null;
  synonymsJson: string | null;
  verified: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Dimension {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  tableName: string;
  columnName: string;
  synonymsJson: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TableInfo {
  tableName: string;
  columns: string[];
}

function parseSynonyms(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

const selectClass =
  "flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50";

export function SemanticLayer({
  metrics,
  dimensions,
  tables,
}: {
  metrics: Metric[];
  dimensions: Dimension[];
  tables: TableInfo[];
}) {
  const [tab, setTab] = React.useState<"metrics" | "dimensions">("metrics");

  return (
    <div className="px-6 py-6">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Semantic Layer</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          This is the moat. Teach Pulse your business definitions once — what &ldquo;revenue,&rdquo; &ldquo;active
          user,&rdquo; or &ldquo;region&rdquo; actually means — and every answer, chart, and alert inherits the same
          trusted logic. Metrics define the math; dimensions define how you slice it.
        </p>
      </div>

      <div className="mb-5 inline-flex rounded-lg border border-border bg-surface p-1">
        <button
          onClick={() => setTab("metrics")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "metrics" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Sigma className="size-4" /> Metrics
          <Badge variant="muted">{metrics.length}</Badge>
        </button>
        <button
          onClick={() => setTab("dimensions")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "dimensions" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Tags className="size-4" /> Dimensions
          <Badge variant="muted">{dimensions.length}</Badge>
        </button>
      </div>

      {tab === "metrics" ? (
        <MetricsTab metrics={metrics} tables={tables} />
      ) : (
        <DimensionsTab dimensions={dimensions} tables={tables} />
      )}
    </div>
  );
}

/* ---------------------------------- Metrics --------------------------------- */

interface MetricForm {
  name: string;
  displayName: string;
  description: string;
  sqlExpression: string;
  baseTable: string;
  synonyms: string;
  verified: boolean;
}

const emptyMetricForm: MetricForm = {
  name: "",
  displayName: "",
  description: "",
  sqlExpression: "",
  baseTable: "",
  synonyms: "",
  verified: false,
};

function MetricsTab({ metrics, tables }: { metrics: Metric[]; tables: TableInfo[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Metric | null>(null);
  const [form, setForm] = React.useState<MetricForm>(emptyMetricForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm(emptyMetricForm);
    setError(null);
    setOpen(true);
  }

  function openEdit(m: Metric) {
    setEditing(m);
    setForm({
      name: m.name,
      displayName: m.displayName,
      description: m.description ?? "",
      sqlExpression: m.sqlExpression,
      baseTable: m.baseTable ?? "",
      synonyms: parseSynonyms(m.synonymsJson).join(", "),
      verified: Boolean(m.verified),
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.displayName.trim() || !form.sqlExpression.trim()) {
      setError("Name, display name, and SQL expression are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      displayName: form.displayName.trim(),
      description: form.description.trim() || null,
      sqlExpression: form.sqlExpression.trim(),
      baseTable: form.baseTable || null,
      synonyms: form.synonyms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      verified: form.verified,
    };
    const res = await fetch(editing ? `/api/metrics/${editing.id}` : "/api/metrics", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove(m: Metric) {
    if (!confirm(`Delete metric "${m.displayName}"?`)) return;
    const res = await fetch(`/api/metrics/${m.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Reusable aggregations Pulse trusts as the source of truth.</p>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" /> New metric
        </Button>
      </div>

      {metrics.length === 0 ? (
        <EmptyState
          icon={<Sigma className="size-5" />}
          title="No metrics defined"
          description="Define your first metric so Pulse computes it consistently everywhere."
          action={
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4" /> New metric
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => {
            const synonyms = parseSynonyms(m.synonymsJson);
            return (
              <Card key={m.id} className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{m.displayName}</span>
                      {m.verified && (
                        <Badge variant="success">
                          <CheckCircle2 className="size-3" /> Verified
                        </Badge>
                      )}
                    </div>
                    <code className="text-[11px] text-muted-foreground">{m.name}</code>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label="Edit metric">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(m)} aria-label="Delete metric">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {m.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{m.description}</p>}

                <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
                  {m.sqlExpression}
                </pre>

                {(m.baseTable || synonyms.length > 0) && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {m.baseTable && <Badge variant="outline">{m.baseTable}</Badge>}
                    {synonyms.map((s) => (
                      <Badge key={s} variant="muted">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-3 text-[11px] text-muted-foreground">
                  Updated {timeAgo(m.updatedAt ?? m.createdAt ?? Date.now())}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit metric" : "New metric"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name (snake_case)</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="total_revenue"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Total Revenue"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this metric measures and any caveats."
              className="min-h-[60px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>SQL expression</Label>
            <Textarea
              value={form.sqlExpression}
              onChange={(e) => setForm({ ...form, sqlExpression: e.target.value })}
              placeholder="SUM(orders.amount)"
              className="min-h-[70px] font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Base table</Label>
            <select
              className={selectClass}
              value={form.baseTable}
              onChange={(e) => setForm({ ...form, baseTable: e.target.value })}
            >
              <option value="">None</option>
              {tables.map((t) => (
                <option key={t.tableName} value={t.tableName}>
                  {t.tableName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Synonyms (comma-separated)</Label>
            <Input
              value={form.synonyms}
              onChange={(e) => setForm({ ...form, synonyms: e.target.value })}
              placeholder="sales, gross revenue, top line"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => setForm({ ...form, verified: e.target.checked })}
              className="size-4 rounded border-border bg-input accent-primary"
            />
            <span>Mark as verified (trusted definition)</span>
          </label>

          {error && <p className="text-xs text-danger">{error}</p>}

          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? <Spinner /> : editing ? "Save changes" : "Create metric"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------------------- Dimensions -------------------------------- */

interface DimensionForm {
  name: string;
  displayName: string;
  description: string;
  tableName: string;
  columnName: string;
  synonyms: string;
}

const emptyDimensionForm: DimensionForm = {
  name: "",
  displayName: "",
  description: "",
  tableName: "",
  columnName: "",
  synonyms: "",
};

function DimensionsTab({ dimensions, tables }: { dimensions: Dimension[]; tables: TableInfo[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Dimension | null>(null);
  const [form, setForm] = React.useState<DimensionForm>(emptyDimensionForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const columnsForTable = React.useMemo(
    () => tables.find((t) => t.tableName === form.tableName)?.columns ?? [],
    [tables, form.tableName],
  );

  function openNew() {
    setEditing(null);
    setForm(emptyDimensionForm);
    setError(null);
    setOpen(true);
  }

  function openEdit(d: Dimension) {
    setEditing(d);
    setForm({
      name: d.name,
      displayName: d.displayName,
      description: d.description ?? "",
      tableName: d.tableName,
      columnName: d.columnName,
      synonyms: parseSynonyms(d.synonymsJson).join(", "),
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.displayName.trim() || !form.tableName || !form.columnName) {
      setError("Name, display name, table, and column are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      displayName: form.displayName.trim(),
      description: form.description.trim() || null,
      tableName: form.tableName,
      columnName: form.columnName,
      synonyms: form.synonyms
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const res = await fetch(editing ? `/api/dimensions/${editing.id}` : "/api/dimensions", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove(d: Dimension) {
    if (!confirm(`Delete dimension "${d.displayName}"?`)) return;
    const res = await fetch(`/api/dimensions/${d.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">The attributes Pulse uses to group, filter, and break down metrics.</p>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" /> New dimension
        </Button>
      </div>

      {dimensions.length === 0 ? (
        <EmptyState
          icon={<Tags className="size-5" />}
          title="No dimensions defined"
          description="Add dimensions so Pulse knows how to slice your metrics."
          action={
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4" /> New dimension
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dimensions.map((d) => {
            const synonyms = parseSynonyms(d.synonymsJson);
            return (
              <Card key={d.id} className="flex h-full flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.displayName}</div>
                    <code className="text-[11px] text-muted-foreground">{d.name}</code>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)} aria-label="Edit dimension">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(d)} aria-label="Delete dimension">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {d.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>}

                <div className="mt-3">
                  <Badge variant="outline">
                    <span className="font-mono text-[11px]">
                      {d.tableName}.{d.columnName}
                    </span>
                  </Badge>
                </div>

                {synonyms.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {synonyms.map((s) => (
                      <Badge key={s} variant="muted">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-3 text-[11px] text-muted-foreground">
                  Updated {timeAgo(d.updatedAt ?? d.createdAt ?? Date.now())}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit dimension" : "New dimension"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name (snake_case)</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="region"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Region"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this attribute represents."
              className="min-h-[60px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Table</Label>
              <select
                className={selectClass}
                value={form.tableName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tableName: e.target.value,
                    columnName: "",
                  })
                }
              >
                <option value="">Select table…</option>
                {tables.map((t) => (
                  <option key={t.tableName} value={t.tableName}>
                    {t.tableName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Column</Label>
              <select
                className={selectClass}
                value={form.columnName}
                onChange={(e) => setForm({ ...form, columnName: e.target.value })}
                disabled={!form.tableName}
              >
                <option value="">{form.tableName ? "Select column…" : "Pick a table first"}</option>
                {columnsForTable.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Synonyms (comma-separated)</Label>
            <Input
              value={form.synonyms}
              onChange={(e) => setForm({ ...form, synonyms: e.target.value })}
              placeholder="market, territory, geo"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? <Spinner /> : editing ? "Save changes" : "Create dimension"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
