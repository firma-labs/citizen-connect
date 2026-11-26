import { z } from "zod";
import { dept } from "@/lib/reference";
import { getStore } from "@/lib/server/store";
import { errorJson, json, parseToken } from "@/lib/server/http";
import { normaliseMobile } from "@/lib/token";
import type { Application } from "@/lib/types";

const Body = z.object({ token: z.string(), mobile: z.string() });

type Stage = "received" | "routed" | "acknowledged" | "in_progress" | "closed";

/**
 * When the application reached each stage of the citizen's tracker, from its
 * history. A transfer to another department starts again from "sent to
 * department"; reopening clears "resolved". Dates only, nothing about who.
 */
function stageDates(app: Application): Record<Stage, string | null> {
  const d: Record<Stage, string | null> = { received: app.captured_at, routed: null, acknowledged: null, in_progress: null, closed: null };
  for (const a of app.audit) {
    switch (a.action) {
      case "verified_and_routed":
      case "transferred":
        Object.assign(d, { routed: a.at, acknowledged: null, in_progress: null, closed: null });
        break;
      case "acknowledged":
        d.acknowledged = a.at;
        break;
      case "in_progress":
        d.in_progress = a.at;
        break;
      case "resolved":
      case "resolved_on_the_spot":
      case "archived":
        d.closed = a.at;
        break;
      case "reopened":
        Object.assign(d, { in_progress: a.at, closed: null });
        break;
      case "restored":
        d.closed = null;
        break;
    }
  }
  return d;
}

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
    app.status === "closed" || app.archived ? "closed" : app.status === "in_progress" ? "in_progress" : app.status === "acknowledged" ? "acknowledged" : app.status === "routed" ? "routed" : "received";
  return json({
    token: app.token,
    stage,
    received_at: app.captured_at,
    dates: stageDates(app),
    department: d ? { code: d.code, name: d.name, mr: d.mr } : null,
    sla_due_at: app.sla_due_at,
    closing_remark: app.status === "closed" ? app.closing_remark : null,
  });
}
