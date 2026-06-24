import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { provisionDemoWorkspace } from "@/lib/onboarding";
import { json, fail, route } from "@/lib/api";

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "workspace"
  );
}

export async function POST(req: Request) {
  return route(async () => {
    const { email, password, name, company } = await req.json();
    if (!email || !password) return fail("Email and password are required.");
    if (String(password).length < 6) return fail("Password must be at least 6 characters.");

    const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (existing) return fail("An account with that email already exists.", 409);

    const passwordHash = await hashPassword(password);
    const user = db.insert(schema.users).values({ email, name: name ?? null, passwordHash }).returning().get();

    const baseSlug = slugify(company ?? name ?? email.split("@")[0]);
    let slug = baseSlug;
    let i = 1;
    while (db.select().from(schema.workspaces).where(eq(schema.workspaces.slug, slug)).get()) slug = `${baseSlug}-${i++}`;

    const ws = db.insert(schema.workspaces).values({ name: company ?? `${name ?? "My"}'s Workspace`, slug, createdByUserId: user.id }).returning().get();
    db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: user.id, role: "owner" }).run();

    await provisionDemoWorkspace(ws.id, user.id);
    await createSession({ userId: user.id, email: user.email, workspaceId: ws.id });

    return json({ ok: true, user: { id: user.id, email: user.email, name: user.name }, workspace: { id: ws.id, name: ws.name } });
  });
}
