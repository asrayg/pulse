import { requireCtx, json, route, fail, getDataSource } from "@/lib/api";
import { getAdapter } from "@/lib/adapters";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const ctx = await requireCtx();
    const { id } = await params;
    const ds = getDataSource(ctx.workspaceId, id);
    if (!ds) return fail("Data source not found", 404);

    const adapter = getAdapter(ds);
    const result = await adapter.test();
    return json({ ok: result.ok, message: result.message });
  });
}
