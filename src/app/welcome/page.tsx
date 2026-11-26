"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PublicFooter } from "@/components/PublicFooter";
import { InitialsAvatar, StepArt, StoryArt, type StepArtKind } from "@/components/StoryArt";
import { AppBar, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { StatTile } from "@/components/ui/StatTile";
import { useIsStaff } from "@/lib/client/session";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { dept, refLabel } from "@/lib/reference";
import { SAMPLE_STORIES, sampleFigures, type ResolutionFigures } from "@/lib/stories";

// Public landing page: what the Janata Darbar service is, a status check,
// headline figures, sample citizen stories (clearly labelled), and staff
// sign-in as the next screen. Signed-out visits to "/" land here.

/** Below this many real applications the figures say little; sample ones (labelled) are shown instead. */
const MIN_FOR_LIVE_FIGURES = 10;

export default function WelcomePage() {
  return (
    <>
      <AppBar publicPage />
      <Screen wide padBottom={false}>
        <Welcome />
      </Screen>
    </>
  );
}

function Welcome() {
  const { t } = useI18n();
  const staff = useIsStaff();
  return (
    <div className="pb-10">
      <section className="relative isolate overflow-hidden rounded-[var(--radius-hero)] bg-gradient-to-br from-indigo-50 via-sky-50 to-mint-50 p-6 sm:p-10">
        <h1 className="font-display text-[2.1rem] font-bold leading-tight tracking-tight sm:text-[2.6rem]">{t("app.name")}</h1>
        <p className="mt-2 text-[1.2rem] font-semibold text-indigo-800">{t("welcome.tagline")}</p>
        <p className="mt-3 max-w-2xl text-ink-2">{t("welcome.lead")}</p>
        <div className="mt-6 max-w-xl">
          <StatusCheck />
        </div>
      </section>

      <HowItWorks />
      <Figures />
      <Stories />

      <section aria-labelledby="staff" className="mt-10 rounded-[var(--radius-panel)] bg-surface-container p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <h2 id="staff" className="text-[1.2rem] font-bold">
            {t("welcome.staff.title")}
          </h2>
          <p className="mt-1 text-ink-2">{t("welcome.staff.body")}</p>
        </div>
        <Button href={staff ? "/" : "/login"} variant="secondary" className="mt-4 shrink-0 sm:mt-0">
          {t(staff ? "welcome.staff.open" : "welcome.staff.button")}
        </Button>
      </section>

      <PublicFooter />
    </div>
  );
}

/** Token box: opens the status page with the token filled in (it asks for the mobile number there). */
function StatusCheck() {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(token.trim() ? `/track?t=${encodeURIComponent(token.trim())}` : "/track");
      }}
      className="rounded-[var(--radius-panel)] bg-surface p-4 shadow-[var(--elevation-1)]"
    >
      <label htmlFor="welcome-token" className="block font-semibold">
        {t("welcome.status.title")}
      </label>
      <p className="text-[0.92rem] text-ink-3">{t("welcome.status.hint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          id="welcome-token"
          value={token}
          onChange={(e) => setToken(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="TH-2211-7KQ4X"
          className={`${inputClass()} token min-w-[12rem] flex-1 text-[1.15rem]`}
        />
        <Button type="submit" icon="search">
          {t("welcome.status.check")}
        </Button>
      </div>
    </form>
  );
}

const STEPS: { art: StepArtKind; title: MessageKey; body: MessageKey }[] = [
  { art: "scan", title: "welcome.how.s1.title", body: "welcome.how.s1.body" },
  { art: "read", title: "welcome.how.s2.title", body: "welcome.how.s2.body" },
  { art: "token", title: "welcome.how.s3.title", body: "welcome.how.s3.body" },
  { art: "route", title: "welcome.how.s4.title", body: "welcome.how.s4.body" },
  { art: "track", title: "welcome.how.s5.title", body: "welcome.how.s5.body" },
];

/**
 * The journey from letter to resolution, all steps at once (a sequence reads
 * best when nothing is hidden): a connected vertical stepper on phones and
 * tablets, one row with arrows on wide screens.
 */
function HowItWorks() {
  const { t, num } = useI18n();
  const last = STEPS.length - 1;
  return (
    <section aria-labelledby="how" className="mt-10">
      <h2 id="how" className="text-[1.35rem] font-bold">
        {t("welcome.how.title")}
      </h2>
      <ol className="card mt-4 p-5 lg:grid lg:grid-cols-5 lg:gap-4 lg:p-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className={`relative flex gap-4 lg:flex-col lg:gap-3 ${i < last ? "pb-6 lg:pb-0" : ""}`}>
            {/* Line to the next step (phones), arrow to the next step (wide screens). */}
            {i < last && (
              <>
                <span aria-hidden className="absolute bottom-0 left-[23px] top-14 w-0.5 rounded-full bg-indigo-200 lg:hidden" />
                <span aria-hidden className="absolute -right-3.5 top-3.5 hidden text-indigo-600/60 lg:block">
                  <Icon name="next" size={22} />
                </span>
              </>
            )}
            <span className="relative shrink-0 self-start">
              <StepArt kind={s.art} size={48} />
              <span className="absolute -left-1.5 -top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-primary px-1 font-display text-[0.75rem] font-bold text-on-primary ring-[3px] ring-surface-container">
                {num(i + 1)}
              </span>
            </span>
            <div className="min-w-0 pt-0.5 lg:pt-0">
              <p className="font-semibold leading-snug">{t(s.title)}</p>
              <p className="mt-0.5 text-[0.93rem] leading-relaxed text-ink-2">{t(s.body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Resolution figures: the live ones once the pilot has enough applications,
 * until then the sample set, labelled "Sample" like the stories.
 */
function Figures() {
  const { t, num, locale, date } = useI18n();
  const [live, setLive] = useState<ResolutionFigures | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/public/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then(setLive)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  if (!loaded) return null; // don't flash sample figures before the live ones arrive
  const isLive = !!live && live.received >= MIN_FOR_LIVE_FIGURES;
  const f = isLive ? live : sampleFigures();
  const monthName = (m: string) => date(`${m}-15T00:00:00Z`, { month: "long", year: "numeric" });
  const period =
    f.period === "12m"
      ? t("welcome.figures.period12m")
      : t("welcome.figures.periodPilot", { month: monthName(f.since) });
  return (
    <section aria-labelledby="figures" className="mt-10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="figures" className="text-[1.35rem] font-bold">
          {t("welcome.figures.title")}
        </h2>
        {isLive ? (
          <span className="shrink-0 rounded-full bg-mint-50 px-2.5 py-0.5 text-[0.78rem] font-bold uppercase tracking-wide text-mint-700">
            {t("welcome.figures.live")}
          </span>
        ) : (
          <SampleChip />
        )}
      </div>
      <p className="mt-1 font-semibold text-ink-2">
        {period}
        {isLive && f.updated_at && (
          <span className="font-normal text-ink-3">
            {" · "}
            {t("welcome.figures.updated", { time: date(f.updated_at, { hour: "numeric", minute: "2-digit" }) })}
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[0.92rem] text-ink-3">{t(isLive ? "welcome.figures.liveNote" : "welcome.figures.sampleNote")}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile tone="sky" value={num(f.received)} label={t("welcome.figures.received")} />
        <StatTile
          tone="mint"
          value={`${num(f.resolved_pct)}%`}
          label={t("welcome.figures.resolved")}
          sub={t("welcome.figures.resolvedSub", { n: num(f.resolved) })}
        />
        {f.avg_days_to_resolve !== null && (
          <StatTile tone="violet" value={num(f.avg_days_to_resolve)} label={t("welcome.figures.days")} />
        )}
        <StatTile tone="peach" value={`${num(f.within_time_pct)}%`} label={t("welcome.figures.withinTime")} />
      </div>

      {f.resolved_on_spot > 0 && (
        <p className="mt-3 flex items-center gap-2 font-semibold text-mint-700">
          <Icon name="check" size={20} />
          {t("welcome.figures.onSpot", { n: num(f.resolved_on_spot) })}
        </p>
      )}

      {f.monthly.length > 0 && <MonthlyTrend monthly={f.monthly} />}

      {f.departments.length > 0 && (
        <div className="card mt-4 p-5">
          <h3 className="font-semibold">{t("welcome.figures.byDept")}</h3>
          <ul className="mt-3 space-y-3.5">
            {f.departments.map((d) => (
              <li key={d.code}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">{refLabel(dept(d.code), locale) || d.code}</span>
                  <span className="text-[0.88rem] text-ink-3">
                    {t("welcome.figures.deptRow", { resolved: num(d.resolved), received: num(d.received) })}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden>
                    <i className="block h-full rounded-full bg-mint-500" style={{ width: `${d.rate}%` }} />
                  </span>
                  <span className="w-11 text-right font-display font-bold text-mint-700">{num(d.rate)}%</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Month by month: received and resolved side by side (one scale, grouped
 * bars). Legend + labelled latest month, a tooltip per month, and a table view.
 */
function MonthlyTrend({ monthly }: { monthly: ResolutionFigures["monthly"] }) {
  const { t, num, date } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...monthly.flatMap((m) => [m.received, m.resolved]));
  const short = (m: string) => date(`${m}-15T00:00:00Z`, { month: "short" });
  const long = (m: string) => date(`${m}-15T00:00:00Z`, { month: "long", year: "numeric" });
  const last = monthly.length - 1;
  const shown = active ?? last;
  const n = monthly.length;
  return (
    <div className="card mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="font-semibold">{t("welcome.figures.trend")}</h3>
        <button type="button" onClick={() => setTable((v) => !v)} className="text-[0.9rem] font-semibold text-primary underline-offset-4 hover:underline">
          {t(table ? "welcome.figures.showChart" : "welcome.figures.showTable")}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.88rem] text-ink-2">
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="h-3 w-3 rounded-[3px] bg-sky-500" /> {t("welcome.figures.received")}
        </span>
        <span className="flex items-center gap-1.5">
          <i aria-hidden className="h-3 w-3 rounded-[3px] bg-mint-500" /> {t("welcome.figures.resolved")}
        </span>
      </div>

      {table ? (
        <table className="mt-4 w-full text-[0.92rem]">
          <thead>
            <tr className="text-left text-ink-3">
              <th className="py-1.5 font-semibold">{t("welcome.figures.month")}</th>
              <th className="py-1.5 text-right font-semibold">{t("welcome.figures.received")}</th>
              <th className="py-1.5 text-right font-semibold">{t("welcome.figures.resolved")}</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-t border-rule">
                <td className="py-1.5">{long(m.month)}</td>
                <td className="py-1.5 text-right tabular-nums">{num(m.received)}</td>
                <td className="py-1.5 text-right tabular-nums">{num(m.resolved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          {/* The month in focus (latest by default; hover, tap or focus a month to change). */}
          <p className="mt-3 text-[0.92rem] text-ink-2" aria-live="polite">
            <span className="font-semibold text-ink">{long(monthly[shown].month)}</span>
            {" · "}
            {t("welcome.figures.monthRow", { received: num(monthly[shown].received), resolved: num(monthly[shown].resolved) })}
          </p>
          <div className="mt-3 flex h-36 items-end gap-[3px] border-b border-rule sm:gap-2" onMouseLeave={() => setActive(null)}>
            {monthly.map((m, i) => (
              <button
                key={m.month}
                type="button"
                aria-label={`${long(m.month)}: ${t("welcome.figures.monthRow", { received: num(m.received), resolved: num(m.resolved) })}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-t-[6px] px-[1px] outline-offset-2 transition-colors ${shown === i ? "bg-ink/5" : ""}`}
              >
                <i className="block w-full max-w-4 rounded-t-[4px] bg-sky-500" style={{ height: `${(m.received / max) * 100}%` }} />
                <i className="block w-full max-w-4 rounded-t-[4px] bg-mint-500" style={{ height: `${(m.resolved / max) * 100}%` }} />
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-[3px] sm:gap-2" aria-hidden>
            {monthly.map((m, i) => {
              // On phones every other month is labelled, always including the latest.
              const phoneLabel = n <= 6 || (last - i) % 2 === 0;
              const firstPhoneLabel = n <= 6 ? 0 : last % 2;
              // Wide screens: the year under every month. Phones (narrow columns): only
              // under the first labelled month and every January.
              const jan = m.month.endsWith("-01");
              const yearWide = true;
              const yearPhone = phoneLabel && (i === firstPhoneLabel || jan);
              const yearCls = yearWide && yearPhone ? "" : yearWide ? "max-sm:invisible" : yearPhone ? "sm:invisible" : "invisible";
              return (
                <span key={m.month} className={`min-w-0 flex-1 text-center text-[0.7rem] leading-tight text-ink-3 ${phoneLabel ? "" : "max-sm:invisible"}`}>
                  <span className="block truncate">{short(m.month)}</span>
                  {/* Wider than a month column on phones: centred under it, spilling over its unlabelled neighbours. */}
                  <span className={`flex justify-center font-semibold whitespace-nowrap text-ink-2 ${yearCls}`}>{m.month.slice(0, 4)}</span>
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Sample stories. Phones: a swipe carousel (one card at a time, the next one
 * peeking in, no scrollbar) with dots that show where you are and jump to a
 * story. Wider screens: a two-column grid.
 */
function Stories() {
  const { t, num } = useI18n();
  const track = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  const total = SAMPLE_STORIES.length;

  // Which card is centred, from the scroll position (works for swipes and dot taps alike).
  function onScroll() {
    const el = track.current;
    if (!el) return;
    const cards = [...el.children] as HTMLElement[];
    const centre = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    cards.forEach((c, i) => {
      if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - centre)) best = i;
    });
    setCurrent(best);
  }

  function goTo(i: number) {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
  }

  return (
    <section aria-labelledby="stories" aria-roledescription="carousel" className="mt-10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="stories" className="text-[1.35rem] font-bold">
          {t("welcome.stories.title")}
        </h2>
        <SampleChip />
      </div>
      <p className="mt-1 text-[0.92rem] text-ink-3">{t("welcome.stories.note")}</p>
      <ul
        ref={track}
        onScroll={onScroll}
        className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {SAMPLE_STORIES.map((s, i) => (
          <li
            key={s.id}
            aria-roledescription="slide"
            aria-label={t("welcome.stories.slide", { n: num(i + 1), total: num(total) })}
            className="card flex w-[85%] shrink-0 snap-center snap-always flex-col p-5 sm:w-auto"
          >
            <div className="flex items-center gap-3">
              <StoryArt art={s.art} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{t(s.issue)}</p>
                <p className="text-[0.88rem] font-semibold text-mint-700">{t("welcome.stories.days", { d: num(s.days) })}</p>
              </div>
            </div>
            <blockquote className="mt-4 flex-1 text-[1.02rem] leading-relaxed text-ink">
              <span aria-hidden className="mr-0.5 font-display text-[1.6rem] leading-none text-indigo-600">
                “
              </span>
              {t(s.quote)}
            </blockquote>
            <div className="mt-4 flex items-center gap-3">
              <InitialsAvatar name={t(s.name)} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{t(s.name)}</p>
                <p className="text-[0.88rem] text-ink-3">{t(s.place)}</p>
              </div>
              <SampleChip />
            </div>
          </li>
        ))}
      </ul>
      {/* Dots: phones only (the grid shows every story on wider screens). */}
      <div className="mt-3 flex justify-center gap-1 sm:hidden">
        {SAMPLE_STORIES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={t("welcome.stories.goTo", { n: num(i + 1), total: num(total) })}
            aria-current={i === current ? "true" : undefined}
            className="grid h-8 w-8 place-items-center rounded-full"
          >
            <span className={`block h-2 rounded-full transition-all duration-200 ${i === current ? "w-6 bg-primary" : "w-2 bg-ink/25"}`} />
          </button>
        ))}
      </div>
      <p className="mt-3 text-[0.92rem]">
        <Link href="/track" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("welcome.stories.cta")}
        </Link>
      </p>
    </section>
  );
}

function SampleChip() {
  const { t } = useI18n();
  return (
    <span className="shrink-0 rounded-full bg-marigold-50 px-2.5 py-0.5 text-[0.78rem] font-bold uppercase tracking-wide text-marigold-700">
      {t("welcome.stories.sample")}
    </span>
  );
}
