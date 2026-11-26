"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ScanFab } from "@/components/ScanFab";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { daysOpen, isOverdue } from "@/lib/dashboard";
import { useOfficeApplications, type ServerRow } from "@/lib/client/office";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { DEPARTMENTS, dept, refLabel, venue } from "@/lib/reference";
import { isOpenCase, isRouted } from "@/lib/types";

type StatusFilter = "" | "open" | "overdue" | "resolved";
const PAGE = 40;
const istDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/**
 * Every application after staff verified and routed it (the mock's
 * "Applications" view): search and filter, then open one to record what the
 * department did.
 */
export default function ApplicationsPage() {
  const { t, num, date, locale } = useI18n();
  const { server } = useOfficeApplications(20_000);
  const [q, setQ] = useState("");
  const [fd, setFd] = useState("");
  const [fs, setFs] = useState<StatusFilter>("");
  const [fsess, setFsess] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => (server ?? []).filter((r) => !r.archived && r.verified && isRouted(r.status)), [server]);
  const sessions = useMemo(() => {
    const m = new Map<string, { venue: string; date: string }>();
    for (const r of rows) m.set(`${r.venue}|${istDate(r.captured_at)}`, { venue: r.venue, date: istDate(r.captured_at) });
    return [...m.entries()].sort((a, b) => b[1].date.localeCompare(a[1].date));
  }, [rows]);

  // Search, department and session first; the status chips then count and narrow within that.
  const base = rows.filter((r) => {
    const v = r.verified!;
    const hay = `${r.token} ${v.applicant_name_original ?? ""} ${v.applicant_name_roman ?? ""} ${v.subject ?? ""}`.toLowerCase();
    if (q && !hay.includes(q.trim().toLowerCase())) return false;
    if (fd && v.department !== fd) return false;
    if (fsess && `${r.venue}|${istDate(r.captured_at)}` !== fsess) return false;
    return true;
  });
  const inStatus = (r: ServerRow, f: StatusFilter) =>
    f === "" || (f === "open" ? isOpenCase(r.status) : f === "resolved" ? r.status === "closed" : isOverdue(r));
  const filtered = base
    .filter((r) => inStatus(r, fs))
    // Overdue first, then the longest waiting.
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || daysOpen(b) - daysOpen(a));

  const sessionLabel = (s: { venue: string; date: string }) => `${refLabel(venue(s.venue), locale)} · ${date(s.date, { day: "numeric", month: "short", year: "numeric" })}`;
  const CHIPS: { f: StatusFilter; label: MessageKey; dot?: string }[] = [
    { f: "", label: "apps.all" },
    { f: "open", label: "apps.open", dot: "bg-sky-500" },
    { f: "overdue", label: "apps.overdue", dot: "bg-red-500" },
    { f: "resolved", label: "apps.resolved", dot: "bg-mint-500" },
  ];

  return (
    <>
      <AppBar />
      <Screen wide>
        <h1 className="mb-4 text-[1.7rem] font-bold tracking-tight">{t("apps.title")}</h1>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="relative col-span-2 lg:col-span-1">
            <span className="sr-only">{t("apps.search")}</span>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("apps.search")} className={`${inputClass()} pl-11`} />
          </label>
          <select aria-label={t("apps.department")} value={fd} onChange={(e) => setFd(e.target.value)} className={`${inputClass()} min-w-0 truncate`}>
            <option value="">{t("apps.allDepartments")}</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {refLabel(d, locale)}
              </option>
            ))}
          </select>
          <select aria-label={t("apps.session")} value={fsess} onChange={(e) => setFsess(e.target.value)} className={`${inputClass()} min-w-0 truncate`}>
            <option value="">{t("apps.allSessions")}</option>
            {sessions.map(([k, s]) => (
              <option key={k} value={k}>
                {sessionLabel(s)}
              </option>
            ))}
          </select>
        </div>

        {/* Status: chips with counts (Material 3 filter chips), one row, swipe if they don't fit. */}
        <div
          role="group"
          aria-label={t("apps.status")}
          className="-mx-4 mt-3 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {CHIPS.map((c) => {
            const on = fs === c.f;
            const n = base.filter((r) => inStatus(r, c.f)).length;
            return (
              <button
                key={c.f || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setFs(c.f);
                  setLimit(PAGE);
                }}
                className={`flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3.5 font-medium transition-colors ${on ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-ink-2 hover:bg-surface-container-high"}`}
              >
                {on ? <Icon name="check" size={18} /> : c.dot && <span aria-hidden className={`h-2 w-2 rounded-full ${c.dot}`} />}
                {t(c.label)}
                <span className={`font-display text-[0.88rem] font-bold ${on ? "" : "text-ink-3"}`}>{num(n)}</span>
              </button>
            );
          })}
        </div>

        {server === null ? (
          <p className="card p-6 text-center text-ink-3">{t("apps.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="card p-6 text-center text-ink-3">{rows.length ? t("apps.noMatch") : t("apps.empty")}</p>
        ) : (
          <>
            <ul className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              {filtered.slice(0, limit).map((r) => (
                <CaseCard key={r.token} row={r} />
              ))}
            </ul>

            {filtered.length > limit && (
              <div className="mt-4 text-center">
                <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                  {t("apps.more")}
                </Button>
              </div>
            )}
          </>
        )}
        {/* room so the floating Scan button never covers the last item */}
        <div aria-hidden className="h-20" />
      </Screen>
      <ScanFab />
      <BottomNav />
    </>
  );
}

const DAY = 86_400_000;
/** Whole days past the deadline (at least 1 once it has passed). */
const daysOverdue = (dueIso: string, now = Date.now()) => Math.max(1, Math.floor((now - Date.parse(dueIso)) / DAY));

/**
 * One routed application, the same card anatomy as the Queue: token and
 * status, when and where, who and what, and a footer with the deadline. The
 * whole card opens it (raised, since it is tappable).
 */
function CaseCard({ row: r }: { row: ServerRow }) {
  const { t, date, locale } = useI18n();
  const v = r.verified!;
  const name = v.applicant_name_roman || v.applicant_name_original || "—";
  const overdue = isOverdue(r);
  const deadline =
    r.status === "closed" ? (
      <span className="font-semibold text-mint-700">{r.resolved_on_spot ? t("apps.onSpot") : t("apps.resolvedIn", { n: daysOpen(r) })}</span>
    ) : overdue && r.sla_due_at ? (
      <span className="font-semibold text-red-700">{t("apps.overdueBy", { n: daysOverdue(r.sla_due_at) })}</span>
    ) : r.sla_due_at ? (
      <span className="text-ink-2">{t("apps.due", { date: date(r.sla_due_at, { day: "numeric", month: "short" }) })}</span>
    ) : null;
  return (
    <li>
      <Link href={`/verify?t=${encodeURIComponent(r.token)}`} className="card-elevated raised flex h-full flex-col p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="token text-[1.1rem]">{r.token}</span>
          <StatusTag status={r.status} overdue={overdue} />
        </div>
        <p className="mt-1 text-[0.9rem] text-ink-3">
          {[date(r.verified_at ?? r.captured_at, { day: "numeric", month: "short" }), refLabel(dept(v.department), locale)].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 font-semibold">{name}</p>
        {(v.subject || r.summary_en) && <p className="mt-0.5 line-clamp-2 text-[0.95rem] text-ink-2">{v.subject || r.summary_en}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-rule pt-3 text-[0.9rem] [margin-top:max(0.75rem,auto)]">
          <span className="min-w-0">{deadline}</span>
          <span className="flex shrink-0 items-center gap-0.5 font-semibold text-primary">
            {t("apps.openCase")}
            <Icon name="next" size={18} />
          </span>
        </div>
      </Link>
    </li>
  );
}

