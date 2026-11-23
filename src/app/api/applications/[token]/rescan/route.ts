import { z } from "zod";
import { auditName, sessionFromRequest } from "@/lib/server/auth";
import { VerifyError, startRescan } from "@/lib/server/pipeline";
import { errorJson, json, parseToken, serverError } from "@/lib/server/http";

const Body = z.object({ page_count: z.number().int().min(1).max(40), staff: z.string().min(1) });

/** Start a rescan: the client then PUTs every page and POSTs /read. */
export async function POST(req: Request, ctx: RouteContext<"/api/applications/[token]/rescan">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, parsed.error.message);
  try {
    const session = sessionFromRequest(req);
    const app = await startRescan(token, parsed.data.page_count, session ? auditName(session) : parsed.data.staff);
    if (!app) return errorJson(404, "not found");
    return json({ pages_version: app.pages_version, page_count: app.page_count });
  } catch (e) {
    if (e instanceof VerifyError) return errorJson(409, e.message);
    return serverError(e);
  }
}
