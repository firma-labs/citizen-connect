// Dashboard figures (PRD §4.1 #9, the "Dashboard" view of the mock): computed
// from the applications on every request — fine for pilot volumes.

import { DEPARTMENTS } from "./reference";
import { isOpenCase, isRouted, type Application } from "./types";

const DAY = 86_400_000;
const istDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export interface DeptStats {
  code: string;
  received: number;
  resolved: number;
  open: number;
  overdue: number;
  /** Resolved ÷ received, 0–100. */
  rate: number;
  avg_days: number | null;
}

export interface DashboardStats {
  generated_at: string;
  /** Every application not archived, including those still waiting for staff to check. */
  received: number;
  awaiting_check: number;
  routed: number;
  resolved: number;
  resolved_pct: number;
  resolved_on_spot: number;
  open: number;
  overdue: number;
  avg_days_to_resolve: number | null;
  high_priority_open: number;
  sla_range: [number, number];
  departments: DeptStats[];
  ageing: { key: "0_7" | "8_15" | "16_30" | "30_plus"; open: number; overdue: number }[];
  sessions: { venue: string; date: string; count: number }[];
  categories: { code: string; count: number }[];
  talukas: { name: string; count: number }[];
}

export const isOverdue = (a: { status: string; sla_due_at?: string | null }, now = Date.now()) =>
  isOpenCase(a.status) && !!a.sla_due_at && Date.parse(a.sla_due_at) < now;

/** Days an application has been with departments: from routing until resolved (or now). */
export const daysOpen = (a: { verified_at?: string | null; captured_at: string; resolved_at?: string | null }, now = Date.now()) =>
  Math.max(0, Math.floor(((a.resolved_at ? Date.parse(a.resolved_at) : now) - Date.parse(a.verified_at ?? a.captured_at)) / DAY));

export function dashboardStats(all: Application[], now = Date.now()): DashboardStats {
  const apps = all.filter((a) => !a.archived);
  const routed = apps.filter((a) => isRouted(a.status) && a.verified);
  const resolved = routed.filter((a) => a.status === "closed");
  const open = routed.filter((a) => isOpenCase(a.status));
  const overdue = open.filter((a) => isOverdue(a, now));
  const avg = (xs: Application[]) => (xs.length ? xs.reduce((s, a) => s + daysOpen(a, now), 0) / xs.length : null);
  const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

  const departments: DeptStats[] = DEPARTMENTS.map((d) => {
    const mine = routed.filter((a) => a.verified!.department === d.code);
    const done = mine.filter((a) => a.status === "closed");
    const o = mine.filter((a) => isOpenCase(a.status));
    return {
      code: d.code,
      received: mine.length,
      resolved: done.length,
      open: o.length,
      overdue: o.filter((a) => isOverdue(a, now)).length,
      rate: mine.length ? Math.round((done.length / mine.length) * 100) : 0,
      avg_days: round1(avg(done)),
    };
  }).filter((d) => d.received > 0);

  const bucket = (days: number) => (days <= 7 ? "0_7" : days <= 15 ? "8_15" : days <= 30 ? "16_30" : "30_plus");
  const ageing = (["0_7", "8_15", "16_30", "30_plus"] as const).map((key) => {
    const inBucket = open.filter((a) => bucket(daysOpen(a, now)) === key);
    return { key, open: inBucket.length, overdue: inBucket.filter((a) => isOverdue(a, now)).length };
  });

  const count = <K extends string>(xs: (K | null | undefined)[]) => {
    const m = new Map<K, number>();
    for (const x of xs) if (x) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const sessionMap = new Map<string, { venue: string; date: string; count: number }>();
  for (const a of apps) {
    const date = istDate(a.captured_at);
    const k = `${a.venue}|${date}`;
    const s = sessionMap.get(k) ?? { venue: a.venue, date, count: 0 };
    s.count++;
    sessionMap.set(k, s);
  }
  const slas = DEPARTMENTS.map((d) => d.sla);

  return {
    generated_at: new Date(now).toISOString(),
    received: apps.length,
    awaiting_check: apps.length - routed.length,
    routed: routed.length,
    resolved: resolved.length,
    resolved_pct: routed.length ? Math.round((resolved.length / routed.length) * 100) : 0,
    resolved_on_spot: resolved.filter((a) => a.resolved_on_spot).length,
    open: open.length,
    overdue: overdue.length,
    avg_days_to_resolve: round1(avg(resolved)),
    high_priority_open: open.filter((a) => a.verified!.priority === "urgent" || a.verified!.priority === "high").length,
    sla_range: [Math.min(...slas), Math.max(...slas)],
    departments: departments.sort((a, b) => b.open - a.open || b.received - a.received),
    ageing,
    sessions: [...sessionMap.values()].sort((a, b) => b.date.localeCompare(a.date)),
    categories: count(routed.map((a) => a.verified!.category)).map(([code, n]) => ({ code, count: n })),
    talukas: count(routed.map((a) => a.verified!.taluka?.trim() || null))
      .slice(0, 8)
      .map(([name, n]) => ({ name, count: n })),
  };
}
