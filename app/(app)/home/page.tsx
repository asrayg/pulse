import Link from "next/link";
import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { LayoutDashboard, Database, Bell, History, ArrowRight, MessageSquare } from "lucide-react";
import { HomeHero } from "@/components/home/home-hero";
import { Card } from "@/components/ui/card";
import { Badge, EmptyState } from "@/components/ui/misc";
import { timeAgo } from "@/lib/utils";

export default async function HomePage() {
  const ctx = await getCtx();
  const wid = ctx?.workspaceId;

  const dashboards = wid ? db.select().from(schema.dashboards).where(eq(schema.dashboards.workspaceId, wid)).orderBy(desc(schema.dashboards.updatedAt)).limit(4).all() : [];
  const sources = wid ? db.select().from(schema.dataSources).where(eq(schema.dataSources.workspaceId, wid)).all() : [];
  const runs = wid ? db.select().from(schema.queryRuns).where(eq(schema.queryRuns.workspaceId, wid)).orderBy(desc(schema.queryRuns.createdAt)).limit(6).all() : [];
  const alerts = wid ? db.select().from(schema.alerts).where(eq(schema.alerts.workspaceId, wid)).all() : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <HomeHero name={(ctx?.user.name ?? "there").split(" ")[0]} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<LayoutDashboard className="size-4" />} label="Dashboards" value={dashboards.length} href="/dashboards" />
        <StatCard icon={<Database className="size-4" />} label="Data sources" value={sources.length} href="/data-sources" />
        <StatCard icon={<Bell className="size-4" />} label="Alerts" value={alerts.length} href="/alerts" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Recent questions" href="/history" icon={<History className="size-4" />} />
          {runs.length === 0 ? (
            <EmptyState title="No questions yet" description="Ask your first question to see it here." className="py-8" />
          ) : (
            <div className="space-y-1.5">
              {runs.map((r) => (
                <Link key={r.id} href={`/ask?q=${encodeURIComponent(r.questionText)}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 hover:border-border-strong">
                  <span className="flex min-w-0 items-center gap-2">
                    <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{r.questionText}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={r.status === "success" ? "muted" : "danger"}>{r.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(r.createdAt!)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle title="Dashboards" href="/dashboards" icon={<LayoutDashboard className="size-4" />} />
          {dashboards.length === 0 ? (
            <EmptyState title="No dashboards yet" description="Ask Pulse to make one for you." className="py-8" />
          ) : (
            <div className="space-y-1.5">
              {dashboards.map((d) => (
                <Link key={d.id} href={`/dashboards/${d.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 hover:border-border-strong">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.title}</div>
                    {d.description && <div className="truncate text-xs text-muted-foreground">{d.description}</div>}
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="flex items-center justify-between p-4 transition-colors hover:border-border-strong">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" />
      </Card>
    </Link>
  );
}

function SectionTitle({ title, href, icon }: { title: string; href: string; icon: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">{icon}{title}</h2>
      <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
    </div>
  );
}
