import { connection } from "next/server";
import { dashboardStats } from "@/lib/dashboard";
import { json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/** Figures for the Minister's dashboard (PRD §4.1 #9). */
export async function GET() {
  await connection();
  return json({ stats: dashboardStats(await getStore().list(2000)) });
}
