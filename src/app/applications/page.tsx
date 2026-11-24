"use client";

import Link from "@/components/ui/Link";
import { useMemo, useState } from "react";
import { ScanFab } from "@/components/ScanFab";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { daysOpen, isOverdue } from "@/lib/dashboard";
import { useOfficeApplications, type ServerRow } from "@/lib/client/office";
import { useI18n } from "@/lib/i18n";
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

  const filtered = rows
    .filter((r) => {
      const v = r.verified!;
      const hay = `${r.token} ${v.applicant_name_original ?? ""} ${v.applicant_name_roman ?? ""} ${v.subject ?? ""}`.toLowerCase();
      if (q && !hay.includes(q.trim().toLowerCase())) return false;
      if (fd && v.department !== fd) return false;
      if (fsess && `${r.venue}|${istDate(r.captured_at)}` !== fsess) return false;
      if (fs === "open" && !isOpenCase(r.status)) return false;
      if (fs === "resolved" && r.status !== "closed") return false;
      if (fs === "overdue" && !isOverdue(r)) return false;
      return true;
    })
    // Overdue first, then the longest waiting.
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || daysOpen(b) - daysOpen(a));

  const sessionLabel = (s: { venue: string; date: string }) => `${refLabel(venue(s.venue), locale)} · ${date(s.date, { day: "numeric", month: "short", year: "numeric" })}`;
  const href = (r: ServerRow) => `/verify?t=${encodeURIComponent(r.token)}`;
  const name = (r: ServerRow) => r.verified!.applicant_name_roman || r.verified!.applicant_name_original || "—";

  return (
    <>
      <AppBar />
      <Screen wide>
        <h1 className="mb-4 text-[1.7rem] font-bold tracking-tight">{t("apps.title")}</h1>

        <div className="mb-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">{t("apps.search")}</span>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("apps.search")} className={`${inputClass()} pl-11`} />
          </label>
          <select aria-label={t("apps.department")} value={fd} onChange={(e) => setFd(e.target.value)} className={inputClass()}>
            <option value="">{t("apps.allDepartments")}</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {refLabel(d, locale)}
              </option>
            ))}
          </select>
          <select aria-label={t("apps.status")} value={fs} onChange={(e) => setFs(e.target.value as StatusFilter)} className={inputClass()}>
            <option value="">{t("apps.allStatuses")}</option>
            <option value="open">{t("apps.open")}</option>
            <option value="overdue">{t("apps.overdue")}</option>
            <option value="resolved">{t("apps.resolved")}</option>
          </select>
          <select aria-label={t("apps.session")} value={fsess} onChange={(e) => setFsess(e.target.value)} className={inputClass()}>
            <option value="">{t("apps.allSessions")}</option>
            {sessions.map(([k, s]) => (
              <option key={k} value={k}>
                {sessionLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-3 text-[0.92rem] text-ink-3">{t("apps.count", { n: filtered.length, total: rows.length })}</p>

        {server === null ? (
          <p className="card p-6 text-center text-ink-3">{t("apps.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="card p-6 text-center text-ink-3">{rows.length ? t("apps.noMatch") : t("apps.empty")}</p>
        ) : (
          <>
            {/* Phones: cards */}
            <ul className="grid gap-3 lg:hidden">
              {filtered.slice(0, limit).map((r) => (
                <li key={r.token}>
                  <Link href={href(r)} className="card block p-4 transition-colors hover:bg-surface-container-high">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="token text-[1.05rem]">{r.token}</span>
                      <StatusTag status={r.status} overdue={isOverdue(r)} />
                    </div>
                    <p className="mt-1 font-semibold">{name(r)}</p>
                    {r.verified!.subject && <p className="line-clamp-2 text-ink-2">{r.verified!.subject}</p>}
                    <p className="mt-1 text-[0.88rem] text-ink-3">
                      {refLabel(dept(r.verified!.department), locale)} · {t("apps.days", { n: daysOpen(r) })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="card hidden overflow-hidden lg:block">
              <table className="w-full text-left">
                <thead className="text-[0.85rem] text-ink-3">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t("apps.token")}</th>
                    <th className="px-4 py-3 font-semibold">{t("apps.applicant")}</th>
                    <th className="px-4 py-3 font-semibold">{t("apps.subject")}</th>
                    <th className="px-4 py-3 font-semibold">{t("apps.department")}</th>
                    <th className="px-4 py-3 font-semibold">{t("apps.status")}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t("apps.daysHead")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((r) => (
                    <tr key={r.token} className="border-t-2 border-surface align-top transition-colors hover:bg-surface-container-high">
                      <td className="px-4 py-3">
                        <Link href={href(r)} className="token whitespace-nowrap text-primary underline-offset-4 hover:underline">
                          {r.token}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium">{name(r)}</td>
                      <td className="max-w-md px-4 py-3 text-ink-2">
                        <span className="line-clamp-2">{r.verified!.subject}</span>
                      </td>
                      <td className="px-4 py-3">{refLabel(dept(r.verified!.department), locale)}</td>
                      <td className="px-4 py-3">
                        <StatusTag status={r.status} overdue={isOverdue(r)} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(daysOpen(r))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
