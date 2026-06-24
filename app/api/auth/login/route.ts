import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { json, fail, route } from "@/lib/api";

export async function POST(req: Request) {
  return route(async () => {
    const { email, password } = await req.json();
    if (!email || !password) return fail("Email and password are required.");

    const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user || !(await verifyPassword(password, user.passwordHash))) return fail("Invalid email or password.", 401);

    const membership = db.select().from(schema.workspaceMembers).where(eq(schema.workspaceMembers.userId, user.id)).get();
    await createSession({ userId: user.id, email: user.email, workspaceId: membership?.workspaceId });

    return json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  });
}
