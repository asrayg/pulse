import { requireCtx, json, route, fail, ApiError } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

function membership(workspaceId: string, userId: string) {
  return db
    .select()
    .from(schema.workspaceMembers)
    .where(
      and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, userId),
      ),
    )
    .get();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await params;
    const ctx = await requireCtx();
    const member = membership(id, ctx.user.id);
    if (!member) throw new ApiError("Not a member of this workspace.", 403);
    const workspace = db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).get();
    if (!workspace) return fail("Workspace not found.", 404);
    return json({ workspace: { ...workspace, role: member.role } });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const { id } = await params;
    const ctx = await requireCtx();
    const member = membership(id, ctx.user.id);
    if (!member) throw new ApiError("Not a member of this workspace.", 403);
    if (member.role !== "owner" && member.role !== "admin") {
      throw new ApiError("Only owners or admins can rename this workspace.", 403);
    }

    const body = (await req.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail("Workspace name is required.");

    const workspace = db
      .update(schema.workspaces)
      .set({ name, updatedAt: new Date().toISOString() })
      .where(eq(schema.workspaces.id, id))
      .returning()
      .get();

    if (!workspace) return fail("Workspace not found.", 404);
    return json({ workspace: { ...workspace, role: member.role } });
  });
}
