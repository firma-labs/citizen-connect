import { z } from "zod";
import { VerifiedFields } from "@/lib/types";
import { auditName, sessionFromRequest } from "@/lib/server/auth";
import { VerifyError, verifyApplication } from "@/lib/server/pipeline";
import { errorJson, json, parseToken, publicOrigin, serverError } from "@/lib/server/http";

const Body = z.object({
  fields: VerifiedFields,
  staff: z.string().min(1),
  confirmed: z.literal(true),
  /** Settled at the Darbar by the Minister or officer present (PRD "Hear" step). */
  resolved_on_spot: z.object({ remark: z.string().trim().min(1).max(1000) }).optional().nullable(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/applications/[token]/verify">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, parsed.error.message);
  try {
    const session = sessionFromRequest(req);
    const app = await verifyApplication(
      token,
      parsed.data.fields,
      session ? auditName(session) : parsed.data.staff,
      publicOrigin(req),
      parsed.data.resolved_on_spot,
    );
    return json({ application: app });
  } catch (e) {
    if (e instanceof VerifyError) return errorJson(409, e.message);
    return serverError(e);
  }
}
