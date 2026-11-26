import { connection } from "next/server";
import { dashboardStats } from "@/lib/dashboard";
import { getStore } from "@/lib/server/store";

/**
 * Headline resolution figures for the public landing page: totals only,
 * nothing about any one application. Public, so cached at the edge for a few
 * minutes.
 */
export async function GET() {
  await connection();
  const apps = await getStore().list(2000);
  const s = dashboardStats(apps);
  const resolved = apps.filter((a) => !a.archived && a.verified && a.status === "closed");
  const inTime = resolved.filter((a) => a.resolved_at && a.sla_due_at && Date.parse(a.resolved_at) <= Date.parse(a.sla_due_at)).length;
  return Response.json(
    {
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
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
