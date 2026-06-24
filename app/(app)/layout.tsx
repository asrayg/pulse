import { redirect } from "next/navigation";
import { getCtx } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");

  const ws = ctx.workspaceId
    ? db.select().from(schema.workspaces).where(eq(schema.workspaces.id, ctx.workspaceId)).get()
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar workspace={ws ? { name: ws.name } : null} user={{ name: ctx.user.name, email: ctx.user.email }} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
