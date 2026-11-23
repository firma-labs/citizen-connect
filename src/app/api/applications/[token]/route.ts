import { z } from "zod";
import { auditName, sessionFromRequest } from "@/lib/server/auth";
import { errorJson, json, notFoundOrGone, parseToken, serverError } from "@/lib/server/http";
import { VerifyError, deleteApplication } from "@/lib/server/pipeline";
import { getStore } from "@/lib/server/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/applications/[token]">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const app = await getStore().get(token);
  if (!app) return notFoundOrGone(token);
  return json({ application: app });
}

const DeleteBody = z.object({ staff: z.string().optional() });

/** Permanently delete an archived application and its pages (pilot only: PILOT_ALLOW_DELETE=1). */
export async function DELETE(req: Request, ctx: RouteContext<"/api/applications/[token]">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const parsed = DeleteBody.safeParse(await req.json().catch(() => ({})));
  const session = sessionFromRequest(req);
  const by = session ? auditName(session) : (parsed.success && parsed.data.staff) || "unknown";
  try {
    const r = await deleteApplication(token, by);
    if (r === "not_found") return notFoundOrGone(token);
    return json({ deleted: true });
  } catch (e) {
    if (e instanceof VerifyError) return errorJson(409, e.message);
    return serverError(e);
  }
}
