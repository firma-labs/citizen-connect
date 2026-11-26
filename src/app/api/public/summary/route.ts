import { connection } from "next/server";
import { dashboardStats } from "@/lib/dashboard";
import { getStore } from "@/lib/server/store";

/**
 * Headline figures for the public landing page: totals only, nothing about
 * any one application. Public, so cached at the edge for a few minutes.
 */
export async function GET() {
  await connection();
  const s = dashboardStats(await getStore().list(2000));
  return Response.json(
    { received: s.received, resolved: s.resolved, resolved_pct: s.resolved_pct, avg_days_to_resolve: s.avg_days_to_resolve },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
}
