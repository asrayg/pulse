"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Database,
  MoreHorizontal,
  Plug,
  RefreshCw,
  Table2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Loader2,
  Upload,
  FileText,
  CheckCircle2,
  Columns3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState, Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/input";
import { cn, timeAgo } from "@/lib/utils";

interface Source {
  id: string;
  name: string;
  type: string;
  status: string | null;
  lastConnectedAt: string | null;
  lastIntrospectedAt: string | null;
  tableCount: number;
  columnCount: number;
}

interface SchemaColumn {
  columnName: string;
  dataType: string | null;
  nullable: boolean | null;
  semanticType: string | null;
  sampleValues: unknown[];
}
interface SchemaTable {
  id: string;
  tableName: string;
  rowCountEstimate: number;
  columns: SchemaColumn[];
}

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

function typeBadgeVariant(type: string): "default" | "success" | "muted" | "outline" {
  if (type === "demo") return "default";
  if (type === "postgres") return "success";
  if (type === "csv") return "muted";
  return "outline";
}

export function DataSourcesIndex({ sources }: { sources: Source[] }) {
  const router = useRouter();
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const pushToast = React.useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <div className="px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Data Sources</h1>
          <p className="text-sm text-muted-foreground">
            Connect databases and files. Pulse reads schema to answer questions accurately.
          </p>
        </div>
        <Button size="sm" onClick={() => setConnectOpen(true)}>
          <Plug className="size-4" /> Connect
        </Button>
      </div>

      {sources.length === 0 ? (
        <EmptyState
          icon={<Database className="size-5" />}
          title="No data sources yet"
          description="Connect a Postgres database or upload a CSV to start asking questions."
          action={
            <Button size="sm" onClick={() => setConnectOpen(true)}>
              <Plug className="size-4" /> Connect a source
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} onToast={pushToast} />
          ))}
        </div>
      )}

      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} onToast={pushToast} />

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg animate-fade-up",
              t.kind === "success" && "border-success/30 bg-success/15 text-success",
              t.kind === "error" && "border-danger/30 bg-danger/15 text-danger",
              t.kind === "info" && "border-border-strong bg-popover text-foreground",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="size-4" />}
            {t.kind === "info" && <Loader2 className="size-4" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceCard({
  source,
  onToast,
}: {
  source: Source;
  onToast: (kind: ToastKind, message: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = React.useState(false);
  const [schema, setSchema] = React.useState<SchemaTable[] | null>(null);
  const [schemaLoading, setSchemaLoading] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const isDemo = source.type === "demo";

  async function testConnection() {
    setMenuOpen(false);
    setBusy("test");
    try {
      const res = await fetch(`/api/data-sources/${source.id}/test`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (data.error) onToast("error", data.error);
      else if (data.ok) onToast("success", data.message || "Connection healthy.");
      else onToast("error", data.message || "Connection failed.");
    } catch {
      onToast("error", "Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function reintrospect() {
    setMenuOpen(false);
    setBusy("introspect");
    try {
      const res = await fetch(`/api/data-sources/${source.id}/introspect`, { method: "POST" });
      const data = (await res.json()) as { tableCount?: number; error?: string };
      if (data.error) onToast("error", data.error);
      else {
        onToast("success", `Re-introspected ${data.tableCount ?? 0} tables.`);
        setSchema(null);
        router.refresh();
      }
    } catch {
      onToast("error", "Re-introspection failed.");
    } finally {
      setBusy(null);
    }
  }

  async function loadSchema() {
    setSchemaLoading(true);
    try {
      const res = await fetch(`/api/data-sources/${source.id}`);
      const data = (await res.json()) as { schema?: { tables: SchemaTable[] }; error?: string };
      if (data.error) onToast("error", data.error);
      else setSchema(data.schema?.tables ?? []);
    } catch {
      onToast("error", "Could not load schema.");
    } finally {
      setSchemaLoading(false);
    }
  }

  async function toggleSchema() {
    setMenuOpen(false);
    const next = !schemaOpen;
    setSchemaOpen(next);
    if (next && schema === null) await loadSchema();
  }

  async function remove() {
    setMenuOpen(false);
    if (!confirm(`Delete "${source.name}"? This removes its stored schema.`)) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/data-sources/${source.id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.error) onToast("error", data.error);
      else {
        onToast("success", "Data source deleted.");
        router.refresh();
      }
    } catch {
      onToast("error", "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Database className="size-4" />
        </div>
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy !== null}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
          </Button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-border-strong bg-popover py-1 text-sm shadow-xl">
              <MenuItem icon={<Plug className="size-4" />} label="Test connection" onClick={testConnection} />
              <MenuItem icon={<RefreshCw className="size-4" />} label="Re-introspect" onClick={reintrospect} />
              <MenuItem
                icon={<Table2 className="size-4" />}
                label={schemaOpen ? "Hide schema" : "View schema"}
                onClick={toggleSchema}
              />
              {!isDemo && (
                <MenuItem
                  icon={<Trash2 className="size-4" />}
                  label="Delete"
                  danger
                  onClick={remove}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="truncate font-medium">{source.name}</div>
        <Badge variant={typeBadgeVariant(source.type)}>{source.type}</Badge>
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Table2 className="size-3.5" /> {source.tableCount} tables
        </span>
        <span className="inline-flex items-center gap-1">
          <Columns3 className="size-3.5" /> {source.columnCount} cols
        </span>
      </div>

      <div className="mt-auto pt-3 text-[11px] text-muted-foreground">
        {source.lastConnectedAt
          ? `Connected ${timeAgo(source.lastConnectedAt)}`
          : "Not yet connected"}
      </div>

      {schemaOpen && (
        <div className="mt-3 border-t border-border pt-3">
          {schemaLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner /> Loading schema…
            </div>
          ) : schema && schema.length > 0 ? (
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {schema.map((t) => (
                <SchemaTableRow key={t.id} table={t} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No tables introspected yet.</div>
          )}
        </div>
      )}
    </Card>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted",
        danger ? "text-danger hover:bg-danger/10" : "text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SchemaTableRow({ table }: { table: SchemaTable }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-md border border-border/70 bg-surface/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium hover:bg-muted/60"
      >
        {open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
        <Table2 className="size-3.5 text-muted-foreground" />
        <span className="truncate">{table.tableName}</span>
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">
          {table.columns.length} cols · ~{table.rowCountEstimate.toLocaleString()} rows
        </span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-border/60 px-2 py-1.5">
          {table.columns.map((c) => (
            <div key={c.columnName} className="flex items-start gap-2 text-[11px]">
              <span className="mt-0.5 font-mono text-foreground">{c.columnName}</span>
              <span className="mt-0.5 text-muted-foreground">{c.dataType}</span>
              {c.semanticType && (
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  {c.semanticType}
                </Badge>
              )}
              {c.sampleValues.length > 0 && (
                <span className="ml-auto max-w-[45%] truncate text-right text-muted-foreground/80">
                  {c.sampleValues
                    .slice(0, 3)
                    .map((v) => (v === null ? "∅" : String(v)))
                    .join(", ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = "postgres" | "csv" | "demo";

function ConnectModal({
  open,
  onClose,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  onToast: (kind: ToastKind, message: string) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("postgres");

  // Postgres form state
  const [name, setName] = React.useState("");
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState("5432");
  const [database, setDatabase] = React.useState("");
  const [user, setUser] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [ssl, setSsl] = React.useState(false);
  const [pgSchema, setPgSchema] = React.useState("public");
  const [pgBusy, setPgBusy] = React.useState(false);

  // CSV form state
  const [csvName, setCsvName] = React.useState("");
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [csvBusy, setCsvBusy] = React.useState(false);

  function resetAndClose() {
    onClose();
  }

  async function submitPostgres() {
    if (!name.trim() || !host.trim() || !database.trim() || !user.trim()) {
      onToast("error", "Name, host, database, and user are required.");
      return;
    }
    setPgBusy(true);
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: "postgres",
          config: {
            host: host.trim(),
            port: Number(port) || 5432,
            database: database.trim(),
            user: user.trim(),
            password,
            ssl,
            schema: pgSchema.trim() || "public",
          },
        }),
      });
      const data = (await res.json()) as { dataSource?: unknown; error?: string };
      if (data.error || !res.ok) {
        onToast("error", data.error || "Could not connect.");
      } else {
        onToast("success", "Postgres connected and introspected.");
        resetAndClose();
        router.refresh();
      }
    } catch {
      onToast("error", "Request failed.");
    } finally {
      setPgBusy(false);
    }
  }

  async function submitCsv() {
    if (!csvFile) {
      onToast("error", "Choose a CSV file first.");
      return;
    }
    setCsvBusy(true);
    try {
      const form = new FormData();
      form.append("file", csvFile);
      if (csvName.trim()) form.append("name", csvName.trim());
      const res = await fetch("/api/files/upload", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok || data.error) {
        onToast("error", data.error || "Upload failed.");
      } else {
        onToast("success", "CSV uploaded.");
        resetAndClose();
        router.refresh();
      }
    } catch {
      onToast("error", "Upload failed.");
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Connect a data source" className="max-w-lg">
      <div className="mb-4 flex gap-1 rounded-md border border-border bg-surface/50 p-1">
        {(["postgres", "csv", "demo"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "postgres" && (
        <div className="space-y-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production DB" autoFocus />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Host</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="db.example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="5432" inputMode="numeric" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Database">
              <Input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="analytics" />
            </Field>
            <Field label="Schema">
              <Input value={pgSchema} onChange={(e) => setPgSchema(e.target.value)} placeholder="public" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="User">
              <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="readonly" />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={ssl}
              onChange={(e) => setSsl(e.target.checked)}
              className="size-3.5 accent-[var(--color-primary)]"
            />
            Require SSL
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitPostgres} disabled={pgBusy}>
              {pgBusy ? <Spinner /> : <Plug className="size-4" />}
              {pgBusy ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </div>
      )}

      {tab === "csv" && (
        <div className="space-y-3">
          <Field label="Name (optional)">
            <Input value={csvName} onChange={(e) => setCsvName(e.target.value)} placeholder="Q3 Sales export" />
          </Field>
          <div className="space-y-1.5">
            <Label>CSV file</Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong/70 bg-surface/40 px-4 py-8 text-center transition-colors hover:border-border-strong">
              <Upload className="size-5 text-muted-foreground" />
              {csvFile ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                  <FileText className="size-4" /> {csvFile.name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Click to choose a .csv file</span>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitCsv} disabled={csvBusy || !csvFile}>
              {csvBusy ? <Spinner /> : <Upload className="size-4" />}
              {csvBusy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      )}

      {tab === "demo" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface/50 p-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Database className="size-4" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-foreground">Demo data is already connected</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Your workspace ships with a ready-to-query demo dataset. Head to Ask to explore it, or connect
                Postgres / upload a CSV to bring in your own data.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={onClose}>
              Got it
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
