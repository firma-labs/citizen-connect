import { dashboardStats, daysOpen, isOverdue } from "@/lib/dashboard";
import { getBriefer, AIError } from "@/lib/server/ai";
import { sessionFromRequest } from "@/lib/server/auth";
import { errorJson, json } from "@/lib/server/http";
import { ANONYMOUS, takeAiRead } from "@/lib/server/quota";
import { getStore } from "@/lib/server/store";
import { isOpenCase } from "@/lib/types";

export const maxDuration = 120;

/**
 * AI briefing for the Minister in English and Marathi, written from the
 * dashboard figures and the open items that need attention. No citizen names
 * or mobile numbers are sent. Counts as one AI reading against the daily limits.
 */
export async function POST(req: Request) {
  const user = sessionFromRequest(req)?.mobile ?? ANONYMOUS;
  const quota = await takeAiRead(user);
  if (!quota.ok) return json({ error: "daily AI limit reached", code: quota.reason === "user" ? "daily_limit" : "daily_limit_total" }, 429);

  const apps = (await getStore().list(2000)).filter((a) => !a.archived);
  const now = Date.now();
  const stats = dashboardStats(apps, now);
  const attention = apps
    .filter((a) => isOpenCase(a.status) && a.verified && (isOverdue(a, now) || a.verified.priority === "urgent" || a.verified.priority === "high"))
    .sort((a, b) => daysOpen(b, now) - daysOpen(a, now))
    .slice(0, 12)
    .map((a) => ({
      token: a.token,
      department: a.verified!.department,
      subject: a.verified!.subject,
      days_open: daysOpen(a, now),
      overdue: isOverdue(a, now),
      priority: a.verified!.priority,
    }));
  try {
    const briefing = await getBriefer().brief({ stats, attention });
    return json({ briefing, generated_at: new Date(now).toISOString() });
  } catch (e) {
    if (e instanceof AIError) return errorJson(502, e.message);
    throw e;
  }
}
