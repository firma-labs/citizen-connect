import "server-only";
import { getStore } from "./store";

// Daily cap on AI readings (PRD pilot on a public URL). One reading = the
// Reader call plus the Reasoner call for one application, so the default of
// 20 readings is 40 model calls a day. Rescans and retries count as readings.

export const AI_DAILY_LIMIT = Math.max(0, Number(process.env.AI_DAILY_LIMIT ?? 20) || 0);

/** Today's date in India time, as YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function takeAiRead(): Promise<boolean> {
  return (await getStore().takeAiRead(todayIST(), AI_DAILY_LIMIT)) !== null;
}

export async function aiUsageToday() {
  return { used: await getStore().aiReadsOn(todayIST()), limit: AI_DAILY_LIMIT };
}
