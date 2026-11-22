import { z } from "zod";
import { dept } from "@/lib/reference";
import { getStore } from "@/lib/server/store";
import { errorJson, json, parseToken } from "@/lib/server/http";
import { normaliseMobile } from "@/lib/token";

const Body = z.object({ token: z.string(), mobile: z.string() });

// Public status check (PRD §4.1 #8): token + mobile. Returns status only — no
// personal data — and the same "not found" for a wrong token or wrong mobile.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, "token and mobile required");
  const token = parseToken(parsed.data.token);
  const mobile = normaliseMobile(parsed.data.mobile);
  if (!token || !mobile) return errorJson(404, "not found");

  const app = await getStore().get(token);
  const verifiedMobile = app?.verified?.mobile ?? null;
  if (!app) return errorJson(404, "not found");
  if (verifiedMobile && verifiedMobile !== mobile) return errorJson(404, "not found");

  const d = dept(app.verified?.department);
  const stage =
    app.status === "closed" ? "closed" : app.status === "in_progress" ? "in_progress" : app.status === "routed" ? "routed" : "received";
  return json({
    token: app.token,
    stage,
    received_at: app.captured_at,
    department: d ? { code: d.code, name: d.name, mr: d.mr } : null,
    sla_due_at: app.sla_due_at,
    closing_remark: app.status === "closed" ? app.closing_remark : null,
  });
}
