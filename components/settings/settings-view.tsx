"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Sparkles,
  Users,
  Database,
  LayoutDashboard,
  Ruler,
  LogOut,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge, Separator, Spinner } from "@/components/ui/misc";
import { PageHeader } from "@/components/layout/page-header";
import { cn, initials, timeAgo } from "@/lib/utils";

interface WorkspaceProps {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}
interface UserProps {
  name: string | null;
  email: string;
}
interface MemberProps {
  name: string | null;
  email: string;
  role: string;
}
interface StatsProps {
  dataSources: number;
  dashboards: number;
  metrics: number;
}

const ROLE_VARIANT: Record<string, "default" | "success" | "warning" | "muted" | "outline"> = {
  owner: "success",
  admin: "default",
  analyst: "outline",
  viewer: "muted",
};

export function SettingsView({
  workspace,
  user,
  members,
  stats,
  llmConfigured,
}: {
  workspace: WorkspaceProps;
  user: UserProps;
  members: MemberProps[];
  stats: StatsProps;
  llmConfigured: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const dirty = name.trim() !== workspace.name && name.trim().length > 0;

  async function saveName() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save changes.");
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — navigate anyway
    } finally {
      router.push("/login");
    }
  }

  const tiles = [
    { label: "Data sources", value: stats.dataSources, icon: Database },
    { label: "Dashboards", value: stats.dashboards, icon: LayoutDashboard },
    { label: "Metrics", value: stats.metrics, icon: Ruler },
  ];

  return (
    <div className="px-6 py-6">
      <PageHeader title="Settings" description="Manage your workspace, members, and AI engine." />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Workspace */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              Workspace
            </CardTitle>
            <CardDescription>General details about this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ws-name">Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                  }}
                  className="max-w-xs"
                />
                <Button onClick={saveName} disabled={!dirty || saving} size="sm">
                  {saving ? (
                    <>
                      <Spinner className="size-4" /> Saving
                    </>
                  ) : saved ? (
                    <>
                      <Check className="size-4" /> Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Slug</Label>
                <p className="font-mono text-sm text-muted-foreground">{workspace.slug}</p>
              </div>
              <div className="space-y-1">
                <Label>Created</Label>
                <p className="text-sm text-muted-foreground">{timeAgo(workspace.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Engine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              AI Engine
            </CardTitle>
            <CardDescription>How Pulse turns your questions into SQL.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {llmConfigured ? (
              <Badge variant="success" className="gap-1.5">
                <Check className="size-3.5" />
                LLM connected — full natural-language analysis
              </Badge>
            ) : (
              <div className="space-y-3">
                <Badge variant="warning" className="gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  Deterministic mode
                </Badge>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Pulse is using its built-in deterministic planner. Add{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    AI_GATEWAY_API_KEY
                  </code>{" "}
                  or{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    ANTHROPIC_API_KEY
                  </code>{" "}
                  to{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code>{" "}
                  for full natural-language SQL generation.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Members
            </CardTitle>
            <CardDescription>
              {members.length} {members.length === 1 ? "person" : "people"} in this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {members.map((m, i) => {
              const display = m.name?.trim() || m.email;
              return (
                <div
                  key={`${m.email}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                      {initials(display)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{display}</p>
                      {m.name ? (
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={ROLE_VARIANT[m.role] ?? "muted"} className="capitalize">
                    {m.role}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>What you have built so far.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {tiles.map((t) => (
                <div
                  key={t.label}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <t.icon className="size-4 text-muted-foreground" />
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
                    {t.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>You are signed in to Pulse.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                {initials(user.name?.trim() || user.email)}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {user.name?.trim() || user.email}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              disabled={signingOut}
              className={cn(signingOut && "opacity-70")}
            >
              {signingOut ? <Spinner className="size-4" /> : <LogOut className="size-4" />}
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
