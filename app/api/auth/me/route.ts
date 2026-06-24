import { getCtx, json } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return json({ user: null }, 200);
  const ws = ctx.workspaceId
    ? db.select().from(schema.workspaces).where(eq(schema.workspaces.id, ctx.workspaceId)).get()
    : null;
  return json({
    user: { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name },
    workspace: ws ? { id: ws.id, name: ws.name, slug: ws.slug } : null,
  });
}
