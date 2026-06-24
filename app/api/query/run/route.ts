import { requireCtx, fail, json, route, getDataSource, defaultDataSource } from "@/lib/api";
import { getAdapter } from "@/lib/adapters";
import { validateSql } from "@/lib/sql/safety";

/** Execute a stored/known SQL string against a data source (tiles, reruns). */
export async function POST(req: Request) {
  return route(async () => {
    const ctx = await requireCtx();
    const { sql, dataSourceId } = await req.json();
    if (!sql) return fail("Missing SQL.");

    const ds = dataSourceId ? getDataSource(ctx.workspaceId, dataSourceId) : defaultDataSource(ctx.workspaceId);
    if (!ds) return fail("Data source not found.", 404);

    const adapter = getAdapter(ds);
    const validation = validateSql(sql, { dialect: adapter.dialect });
    if (!validation.ok) return fail(`Unsafe SQL: ${validation.errors.join("; ")}`, 400);

    const result = await adapter.run(validation.safeSql);
    return json({ result, validation });
  });
}
