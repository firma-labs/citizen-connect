import { getStore } from "@/lib/server/store";
import { errorJson, json, parseToken } from "@/lib/server/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/applications/[token]">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const app = await getStore().get(token);
  if (!app) return errorJson(404, "not found");
  return json({ application: app });
}
