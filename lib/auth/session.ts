import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const COOKIE = "pulse_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "pulse-dev-secret");

export interface SessionPayload {
  userId: string;
  email: string;
  workspaceId?: string;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Resolve the full current user + their default workspace. Throws if unauthenticated. */
export async function requireUser() {
  const session = await getSession();
  if (!session) throw new AuthError("Not authenticated");
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get();
  if (!user) throw new AuthError("User not found");

  let workspaceId = session.workspaceId;
  if (!workspaceId) {
    const membership = db
      .select()
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, user.id))
      .get();
    workspaceId = membership?.workspaceId;
  }
  return { user, workspaceId };
}

export class AuthError extends Error {}
