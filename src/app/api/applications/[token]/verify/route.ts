import { z } from "zod";
import { VerifiedFields } from "@/lib/types";
import { VerifyError, verifyApplication } from "@/lib/server/pipeline";
import { errorJson, json, parseToken, publicOrigin } from "@/lib/server/http";

const Body = z.object({ fields: VerifiedFields, staff: z.string().min(1), confirmed: z.literal(true) });

export async function POST(req: Request, ctx: RouteContext<"/api/applications/[token]/verify">) {
  const token = parseToken((await ctx.params).token);
  if (!token) return errorJson(400, "invalid token");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, parsed.error.message);
  try {
    const app = await verifyApplication(token, parsed.data.fields, parsed.data.staff, publicOrigin(req));
    return json({ application: app });
  } catch (e) {
    if (e instanceof VerifyError) return errorJson(409, e.message);
    throw e;
  }
}
