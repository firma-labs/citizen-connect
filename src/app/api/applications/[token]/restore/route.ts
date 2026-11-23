import { z } from "zod";
import { auditName, sessionFromRequest } from "@/lib/server/auth";
import { errorJson, json, parseToken, withErrors } from "@/lib/server/http";
import { restoreApplication } from "@/lib/server/pipeline";

const Body = z.object({ staff: z.string().optional() });

/** Bring an archived application back into the queue. */
export const POST = withErrors(async (req: Request, ctx: RouteContext<"/api/applications/[token]/restore">) => {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const session = sessionFromRequest(req);
  const by = session ? auditName(session) : (parsed.success && parsed.data.staff) || "unknown";
  const app = await restoreApplication(token, by);
  if (!app) return errorJson(404, "not found");
  return json({ status: app.status, archived: null });
});
