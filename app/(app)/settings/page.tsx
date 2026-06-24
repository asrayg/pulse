import { redirect } from "next/navigation";
import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hasLLM } from "@/lib/agent/llm";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage() {
  const ctx = await getCtx();
  if (!ctx?.workspaceId) redirect("/login");

  const workspace = db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, ctx.workspaceId))
    .get();
  if (!workspace) redirect("/login");

  const memberRows = db
    .select({
      role: schema.workspaceMembers.role,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.users, eq(schema.workspaceMembers.userId, schema.users.id))
    .where(eq(schema.workspaceMembers.workspaceId, ctx.workspaceId))
    .all();

  const dataSources = db
    .select()
    .from(schema.dataSources)
    .where(eq(schema.dataSources.workspaceId, ctx.workspaceId))
    .all().length;

  const dashboards = db
    .select()
    .from(schema.dashboards)
    .where(eq(schema.dashboards.workspaceId, ctx.workspaceId))
    .all().length;

  const metrics = db
    .select()
    .from(schema.metrics)
    .where(eq(schema.metrics.workspaceId, ctx.workspaceId))
    .all().length;

  return (
    <SettingsView
      workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug, createdAt: workspace.createdAt ?? "" }}
      user={{ name: ctx.user.name ?? null, email: ctx.user.email }}
      members={memberRows.map((m) => ({ name: m.name ?? null, email: m.email, role: m.role }))}
      stats={{ dataSources, dashboards, metrics }}
      llmConfigured={hasLLM()}
    />
  );
}
