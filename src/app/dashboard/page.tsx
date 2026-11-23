"use client";

import { useCallback, useEffect, useState } from "react";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { StatTile } from "@/components/ui/StatTile";
import type { DashboardStats } from "@/lib/dashboard";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { category, dept, refLabel, venue } from "@/lib/reference";

/** One horizontal bar: label, a track split into segments, and the total. */
function Bar({ label, total, max, segments }: { label: string; total: number; max: number; segments: { value: number; cls: string }[] }) {
  const { num } = useI18n();
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2.5rem] items-center gap-3 text-[0.92rem] sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_2.5rem]">
      <span className="truncate font-medium" title={label}>
        {label}
      </span>
      <span className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-surface">
        {segments.map((s, i) => (s.value > 0 ? <i key={i} className={`block h-full rounded-full ${s.cls}`} style={{ width: `${(s.value / Math.max(1, max)) * 100}%` }} /> : null))}
      </span>
      <span className="text-right font-semibold tabular-nums">{num(total)}</span>
    </div>
  );
}

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="text-[1.1rem] font-bold">{title}</h2>
      {sub && <p className="mt-0.5 text-[0.9rem] text-ink-3">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const AGE: Record<string, MessageKey> = { "0_7": "dash.age.0_7", "8_15": "dash.age.8_15", "16_30": "dash.age.16_30", "30_plus": "dash.age.30_plus" };

/** Minister's dashboard (PRD §4.1 #9, the mock's "Dashboard" view). */
export default function DashboardPage() {
  const { t, num, date, locale } = useI18n();
  const [s, setS] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d) => {
        setS(d.stats);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const maxOpen = Math.max(1, ...(s?.departments.map((d) => d.open) ?? [1]));
  const maxAge = Math.max(1, ...(s?.ageing.map((a) => a.open) ?? [1]));
  const maxSess = Math.max(1, ...(s?.sessions.map((x) => x.count) ?? [1]));
  const maxCat = Math.max(1, ...(s?.categories.map((x) => x.count) ?? [1]));
  const maxTal = Math.max(1, ...(s?.talukas.map((x) => x.count) ?? [1]));
  const within = "bg-sky-500";
  const late = "bg-red-500";

  return (
    <>
      <AppBar />
      <Screen wide>
        <h1 className="text-[1.7rem] font-bold tracking-tight">{t("dash.title")}</h1>
        <p className="mb-5 text-ink-3">{t("dash.sub")}</p>
        {error && !s && <Notice tone="error">{t("dash.error", { msg: error })}</Notice>}
        {!s && !error && <p className="card p-6 text-center text-ink-3">{t("apps.loading")}</p>}

        {s && (
          <div className="space-y-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2.5 sm:gap-3">
              <StatTile tone="sky" value={num(s.received)} label={t("dash.kpi.received")} sub={s.awaiting_check ? t("dash.kpi.awaiting", { n: s.awaiting_check }) : undefined} />
              <StatTile tone="mint" value={`${num(s.resolved_pct)}%`} label={t("dash.kpi.resolved")} sub={t("dash.kpi.resolvedOf", { a: s.resolved, b: s.routed })} />
              <StatTile tone="violet" value={num(s.open)} label={t("dash.kpi.open")} sub={t("dash.kpi.openSub")} />
              <StatTile tone="rose" value={num(s.overdue)} label={t("dash.kpi.overdue")} sub={t("dash.kpi.overdueSub", { a: s.sla_range[0], b: s.sla_range[1] })} />
              <StatTile
                tone="peach"
                value={s.avg_days_to_resolve === null ? "—" : num(s.avg_days_to_resolve)}
                label={t("dash.kpi.avgDays")}
                sub={s.resolved_on_spot ? t("dash.kpi.onSpot", { n: s.resolved_on_spot }) : t("dash.kpi.avgDaysSub")}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Panel title={t("dash.waiting")} sub={t("dash.waitingSub")}>
                <p className="mb-3 flex flex-wrap gap-4 text-[0.85rem] text-ink-3">
                  <span className="inline-flex items-center gap-1.5">
                    <i className={`inline-block h-2.5 w-2.5 rounded-full ${within}`} />
                    {t("dash.withinTime")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className={`inline-block h-2.5 w-2.5 rounded-full ${late}`} />
                    {t("dash.overdue")}
                  </span>
                </p>
                <div className="grid gap-2.5">
                  {s.departments.filter((d) => d.open).length === 0 && <p className="text-ink-3">{t("dash.noneOpen")}</p>}
                  {s.departments
                    .filter((d) => d.open)
                    .map((d) => (
                      <Bar
                        key={d.code}
                        label={refLabel(dept(d.code), locale)}
                        total={d.open}
                        max={maxOpen}
                        segments={[
                          { value: d.open - d.overdue, cls: within },
                          { value: d.overdue, cls: late },
                        ]}
                      />
                    ))}
                </div>
              </Panel>
              <div className="grid gap-5">
                <Panel title={t("dash.age.title")}>
                  <div className="grid gap-2.5">
                    {s.ageing.map((a) => (
                      <Bar key={a.key} label={t(AGE[a.key])} total={a.open} max={maxAge} segments={[{ value: a.open - a.overdue, cls: within }, { value: a.overdue, cls: late }]} />
                    ))}
                  </div>
                </Panel>
                <Panel title={t("dash.sessions")}>
                  <div className="grid gap-2.5">
                    {s.sessions.slice(0, 6).map((x) => (
                      <Bar
                        key={`${x.venue}|${x.date}`}
                        label={`${refLabel(venue(x.venue), locale)} · ${date(x.date, { day: "numeric", month: "short" })}`}
                        total={x.count}
                        max={maxSess}
                        segments={[{ value: x.count, cls: "bg-indigo-600" }]}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel title={t("dash.categories")}>
                <div className="grid gap-2.5">
                  {s.categories.length === 0 && <p className="text-ink-3">{t("dash.noneYet")}</p>}
                  {s.categories.slice(0, 8).map((c) => (
                    <Bar key={c.code} label={refLabel(category(c.code), locale)} total={c.count} max={maxCat} segments={[{ value: c.count, cls: "bg-mint-500" }]} />
                  ))}
                </div>
              </Panel>
              <Panel title={t("dash.talukas")}>
                <div className="grid gap-2.5">
                  {s.talukas.length === 0 && <p className="text-ink-3">{t("dash.noneYet")}</p>}
                  {s.talukas.map((x) => (
                    <Bar key={x.name} label={x.name} total={x.count} max={maxTal} segments={[{ value: x.count, cls: "bg-marigold-500" }]} />
                  ))}
                </div>
              </Panel>
            </div>

            <Panel title={t("dash.performance")}>
              {s.departments.length === 0 ? (
                <p className="text-ink-3">{t("dash.noneYet")}</p>
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-[0.92rem]">
                    <thead className="text-[0.82rem] text-ink-3">
                      <tr>
                        <th className="px-5 py-2 font-semibold">{t("apps.department")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t("dash.col.received")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t("dash.col.resolved")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t("dash.col.rate")}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t("dash.col.avgDays")}</th>
                        <th className="px-5 py-2 text-right font-semibold">{t("dash.col.overdue")}</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {s.departments.map((d) => (
                        <tr key={d.code} className="border-t-2 border-surface">
                          <td className="px-5 py-2.5 font-medium">{refLabel(dept(d.code), locale)}</td>
                          <td className="px-3 py-2.5 text-right">{num(d.received)}</td>
                          <td className="px-3 py-2.5 text-right">{num(d.resolved)}</td>
                          <td className="px-3 py-2.5 text-right">{num(d.rate)}%</td>
                          <td className="px-3 py-2.5 text-right">{d.avg_days === null ? "—" : num(d.avg_days)}</td>
                          <td className={`px-5 py-2.5 text-right font-semibold ${d.overdue ? "text-red-700" : ""}`}>{num(d.overdue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Briefing />
          </div>
        )}
      </Screen>
      <BottomNav />
    </>
  );
}

/** AI briefing for the Minister in English and Marathi, with Copy buttons. */
function Briefing() {
  const { t, date } = useI18n();
  const [brief, setBrief] = useState<{ en: string; mr: string; at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"en" | "mr" | null>(null);

  async function write() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/briefing", { method: "POST", cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error(t(body.code === "daily_limit" ? "dash.brief.limit" : "dash.brief.limitTotal"));
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setBrief({ ...body.briefing, at: body.generated_at });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(lang: "en" | "mr") {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief[lang]);
      setCopied(lang);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  return (
    <section className="card p-5" aria-labelledby="brief-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="brief-title" className="text-[1.1rem] font-bold">
            {t("dash.brief.title")}
          </h2>
          <p className="mt-0.5 text-[0.9rem] text-ink-3">{t("dash.brief.sub")}</p>
        </div>
        <Button icon="doc" onClick={() => void write()} disabled={busy}>
          {busy ? t("dash.brief.writing") : brief ? t("dash.brief.again") : t("dash.brief.write")}
        </Button>
      </div>
      {error && (
        <Notice tone="error" role="alert" className="mt-4">
          {error}
        </Notice>
      )}
      {brief && (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(["en", "mr"] as const).map((lang) => (
              <div key={lang} className={`rounded-[var(--radius-panel)] p-4 ${lang === "en" ? "bg-primary-container" : "bg-marigold-50"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold" lang={lang}>
                    {lang === "en" ? "English" : "मराठी"}
                  </h3>
                  <Button variant="quiet" size="md" onClick={() => void copy(lang)}>
                    {copied === lang ? t("dash.brief.copied") : t("dash.brief.copy")}
                  </Button>
                </div>
                <p lang={lang} className="whitespace-pre-wrap leading-relaxed">
                  {brief[lang]}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[0.85rem] text-ink-3">{t("dash.brief.at", { date: date(brief.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}</p>
        </>
      )}
    </section>
  );
}
