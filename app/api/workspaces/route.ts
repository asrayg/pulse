import { requireCtx, json, route, fail } from "@/lib/api";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

export async function GET() {
  return route(async () => {
    const ctx = await requireCtx();
    const memberships = db
      .select()
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, ctx.user.id))
      .all();
    const ids = memberships.map((m) => m.workspaceId);
    const workspaces = ids.length
      ? db.select().from(schema.workspaces).where(inArray(schema.workspaces.id, ids)).all()
      : [];
    const roleByWs = new Map(memberships.map((m) => [m.workspaceId, m.role]));
    return json({
      workspaces: workspaces.map((w) => ({ ...w, role: roleByWs.get(w.id) ?? "viewer" })),
    });
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const body = (await req.json()) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail("Workspace name is required.");

    const base = slugify(name);
    let slug = base;
    let attempt = 1;
    while (db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, slug)).get()) {
      attempt += 1;
      slug = `${base}-${attempt}`;
    }

    const workspace = db
      .insert(schema.workspaces)
      .values({ name, slug, createdByUserId: ctx.user.id })
      .returning()
      .get();

    db.insert(schema.workspaceMembers)
      .values({ workspaceId: workspace.id, userId: ctx.user.id, role: "owner" })
      .run();

    return json({ workspace });
  });
}
