import "server-only";
import { getStore } from "./store";

// Daily caps on AI readings, so a pilot on a public URL can't run up a large
// AI bill. One reading = the Reader call plus the Reasoner call for one
// application (2 model calls). Rescans and retries count as readings.
//
//   AI_DAILY_LIMIT_PER_USER  readings per signed-in person per day   (default 20)
//   AI_DAILY_LIMIT_TOTAL     readings per day across everyone        (default 200; 0 = none)
//
// Days are India dates. Without sign-in, everyone shares the "anonymous" allowance.

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

export const AI_LIMIT_PER_USER = num(process.env.AI_DAILY_LIMIT_PER_USER, 20);
export const AI_LIMIT_TOTAL = num(process.env.AI_DAILY_LIMIT_TOTAL, 200);
export const ANONYMOUS = "anonymous";

/** Today's date in India time, as YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function takeAiRead(user: string) {
  return getStore().takeAiRead(todayIST(), user, AI_LIMIT_PER_USER, AI_LIMIT_TOTAL);
}

export async function aiUsageToday(user: string) {
  const used = await getStore().aiReadsOn(todayIST(), user);
  return { user: used.user, userLimit: AI_LIMIT_PER_USER, total: used.total, totalLimit: AI_LIMIT_TOTAL };
}
