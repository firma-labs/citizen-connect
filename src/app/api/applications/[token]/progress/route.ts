import { z } from "zod";
import { DEPARTMENT_CODES } from "@/lib/reference";
import { auditName, sessionFromRequest } from "@/lib/server/auth";
import { errorJson, json, notFoundOrGone, parseToken } from "@/lib/server/http";
import { VerifyError, recordProgress } from "@/lib/server/pipeline";

const note = z.string().trim().max(500).optional().nullable();
const Body = z.intersection(
  z.discriminatedUnion("action", [
    z.object({ action: z.literal("acknowledge"), note }),
    z.object({ action: z.literal("in_progress"), note }),
    z.object({ action: z.literal("remind"), note }),
    z.object({ action: z.literal("transfer"), department: z.enum(DEPARTMENT_CODES), reason: z.string().trim().min(1).max(500) }),
    z.object({ action: z.literal("resolve"), remark: z.string().trim().min(1).max(1000) }),
    z.object({ action: z.literal("reopen"), reason: z.string().trim().min(1).max(500) }),
  ]),
  z.object({ staff: z.string().optional() }),
);

/** Department follow-up after routing: acknowledge, in progress, reminder, transfer, resolve, reopen. */
export async function POST(req: Request, ctx: RouteContext<"/api/applications/[token]/progress">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, parsed.error.message);
  const session = sessionFromRequest(req);
  const { staff, ...act } = parsed.data;
  const by = session ? auditName(session) : staff || "unknown";
  try {
    const app = await recordProgress(token, act, by);
    if (!app) return notFoundOrGone(token);
    return json({ application: app });
  } catch (e) {
    if (e instanceof VerifyError) return errorJson(409, e.message);
    throw e;
  }
}
