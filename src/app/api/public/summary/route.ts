import { connection } from "next/server";
import { dashboardStats } from "@/lib/dashboard";
import { getStore } from "@/lib/server/store";
import type { Application } from "@/lib/types";

/**
 * Headline resolution figures for the public landing page: totals only,
 * nothing about any one application. Public, so cached at the edge for a few
 * minutes.
 *
 * Period: everything since the pilot began, until there is more than a year
 * of data; from then on, the past 12 months (figures and the monthly trend).
 */

/** "YYYY-MM" in India time. */
const monthOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);

/** The 12 months ending with `month` ("YYYY-MM"), oldest first. */
function last12(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export async function GET() {
  await connection();
  const now = new Date().toISOString();
  const all = (await getStore().list(2000)).filter((a) => !a.archived);
  const months12 = last12(monthOf(now));
  const firstMonth = all.length ? all.map((a) => monthOf(a.captured_at)).sort()[0] : monthOf(now);
  // More than a year of data: count only the past 12 months.
  const period = firstMonth < months12[0] ? "12m" : "pilot";
  const apps: Application[] = period === "12m" ? all.filter((a) => monthOf(a.captured_at) >= months12[0]) : all;

  const s = dashboardStats(apps);
  const resolved = apps.filter((a) => a.verified && a.status === "closed");
  const inTime = resolved.filter((a) => a.resolved_at && a.sla_due_at && Date.parse(a.resolved_at) <= Date.parse(a.sla_due_at)).length;

  const months = period === "12m" ? months12 : months12.filter((m) => m >= firstMonth);
  const monthly = months.map((month) => ({
    month,
    received: apps.filter((a) => monthOf(a.captured_at) === month).length,
    resolved: resolved.filter((a) => a.resolved_at && monthOf(a.resolved_at) === month).length,
  }));

  return Response.json(
    {
      period,
      since: firstMonth,
      updated_at: now,
      received: s.received,
      resolved: s.resolved,
      resolved_pct: s.resolved_pct,
      avg_days_to_resolve: s.avg_days_to_resolve,
      resolved_on_spot: s.resolved_on_spot,
      within_time_pct: resolved.length ? Math.round((inTime / resolved.length) * 100) : 0,
      departments: [...s.departments]
        .sort((a, b) => b.received - a.received)
        .slice(0, 4)
        .map((d) => ({ code: d.code, received: d.received, resolved: d.resolved, rate: d.rate })),
      monthly,
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
