import { destroySession } from "@/lib/auth/session";
import { json, route } from "@/lib/api";

export async function POST() {
  return route(async () => {
    await destroySession();
    return json({ ok: true });
  });
}
