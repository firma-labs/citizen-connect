import { z } from "zod";
import { auditName, sessionFromRequest } from "@/lib/server/auth";
import { errorJson, json, parseToken, withErrors } from "@/lib/server/http";
import { archiveApplication } from "@/lib/server/pipeline";
import { ARCHIVE_REASONS } from "@/lib/types";

const Body = z.object({
  reason: z.enum(ARCHIVE_REASONS),
  note: z.string().trim().max(200).optional().nullable(),
  staff: z.string().optional(),
});

/** Take an application out of the queue (duplicate, test scan, mistake). Restorable. */
export const POST = withErrors(async (req: Request, ctx: RouteContext<"/api/applications/[token]/archive">) => {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, parsed.error.message);
  const session = sessionFromRequest(req);
  const by = session ? auditName(session) : parsed.data.staff || "unknown";
  const app = await archiveApplication(token, parsed.data.reason, parsed.data.note || null, by);
  if (!app) return errorJson(404, "not found");
  return json({ archived: app.archived });
});
