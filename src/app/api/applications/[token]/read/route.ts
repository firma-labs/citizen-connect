import { after } from "next/server";
import { claimRead, runRead } from "@/lib/server/pipeline";
import { getStore } from "@/lib/server/store";
import { errorJson, json, parseToken } from "@/lib/server/http";

// AI reading runs after the response is sent; the device polls for the result.
export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/applications/[token]/read">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const app = await getStore().get(token);
  if (!app) return errorJson(404, "not found");

  const claimed = await claimRead(token, !!body.force);
  if (claimed) after(() => runRead(token));
  const current = await getStore().get(token);
  return json({ started: claimed, status: current?.status }, claimed ? 202 : 200);
}
