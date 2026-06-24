import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Resolve the authenticated user + their workspace, or null. */
export async function getCtx() {
  const session = await getSession();
  if (!session) return null;
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).get();
  if (!user) return null;
  const membership = db
    .select()
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.userId, user.id))
    .get();
  const workspaceId = session.workspaceId ?? membership?.workspaceId;
  if (!workspaceId) return { user, workspaceId: null as string | null };
  return { user, workspaceId };
}

/** Throwing variant for route handlers — returns a Response on failure via the caller's try/catch. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function requireCtx() {
  const ctx = await getCtx();
  if (!ctx) throw new ApiError("Not authenticated", 401);
  if (!ctx.workspaceId) throw new ApiError("No workspace", 403);
  return ctx as { user: typeof schema.users.$inferSelect; workspaceId: string };
}

/** The workspace's default data source (prefers demo, else first). */
export function defaultDataSource(workspaceId: string) {
  const sources = db.select().from(schema.dataSources).where(eq(schema.dataSources.workspaceId, workspaceId)).all();
  return sources.find((s) => s.type === "demo") ?? sources[0] ?? null;
}

export function getDataSource(workspaceId: string, id: string) {
  return db
    .select()
    .from(schema.dataSources)
    .where(and(eq(schema.dataSources.workspaceId, workspaceId), eq(schema.dataSources.id, id)))
    .get();
}

/** Wrap a handler so thrown ApiError/Errors become JSON responses. */
export function route(handler: () => Promise<Response> | Response) {
  return Promise.resolve()
    .then(handler)
    .catch((e) => {
      if (e instanceof ApiError) return fail(e.message, e.status);
      console.error("[pulse] route error:", e);
      return fail((e as Error).message ?? "Internal error", 500);
    });
}
