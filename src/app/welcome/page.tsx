"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicFooter } from "@/components/PublicFooter";
import { InitialsAvatar, StoryArt } from "@/components/StoryArt";
import { AppBar, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { StatTile } from "@/components/ui/StatTile";
import { useIsStaff } from "@/lib/client/session";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { SAMPLE_STORIES } from "@/lib/stories";

// Public landing page: what the Janata Darbar service is, a status check,
// headline figures, sample citizen stories (clearly labelled), and staff
// sign-in as the next screen. Signed-out visits to "/" land here.

/** Below this many applications the figures say little, so they are not shown. */
const MIN_FOR_FIGURES = 10;

interface Summary {
  received: number;
  resolved: number;
  resolved_pct: number;
  avg_days_to_resolve: number | null;
}

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

const STEPS: { icon: IconName; title: MessageKey; body: MessageKey; chip: string }[] = [
  { icon: "doc", title: "welcome.how.s1.title", body: "welcome.how.s1.body", chip: "bg-sky-50 text-sky-700" },
  { icon: "check", title: "welcome.how.s2.title", body: "welcome.how.s2.body", chip: "bg-indigo-50 text-indigo-800" },
  { icon: "search", title: "welcome.how.s3.title", body: "welcome.how.s3.body", chip: "bg-mint-50 text-mint-700" },
];

function HowItWorks() {
  const { t, num } = useI18n();
  return (
    <section aria-labelledby="how" className="mt-10">
      <h2 id="how" className="text-[1.35rem] font-bold">
        {t("welcome.how.title")}
      </h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card flex gap-3 p-4 sm:flex-col">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${s.chip}`}>
              <Icon name={s.icon} size={22} />
            </span>
            <div>
              <p className="font-semibold">
                <span className="font-display text-ink-3">{num(i + 1)}.</span> {t(s.title)}
              </p>
              <p className="mt-0.5 text-[0.95rem] text-ink-2">{t(s.body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Live totals from the server; hidden until there are enough applications to mean something. */
function Figures() {
  const { t, num } = useI18n();
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/public/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => {});
  }, []);
  if (!s || s.received < MIN_FOR_FIGURES) return null;
  return (
    <section aria-labelledby="figures" className="mt-10">
      <h2 id="figures" className="text-[1.35rem] font-bold">
        {t("welcome.figures.title")}
      </h2>
      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
        <StatTile tone="sky" value={num(s.received)} label={t("welcome.figures.received")} />
        <StatTile tone="mint" value={`${num(s.resolved_pct)}%`} label={t("welcome.figures.resolved")} />
        {s.avg_days_to_resolve !== null && <StatTile tone="violet" value={num(s.avg_days_to_resolve)} label={t("welcome.figures.days")} />}
      </div>
    </section>
  );
}

function Stories() {
  const { t, num } = useI18n();
  return (
    <section aria-labelledby="stories" className="mt-10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="stories" className="text-[1.35rem] font-bold">
          {t("welcome.stories.title")}
        </h2>
        <SampleChip />
      </div>
      <p className="mt-1 text-[0.92rem] text-ink-3">{t("welcome.stories.note")}</p>
      {/* Swipe through on phones; a grid on wider screens. */}
      <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {SAMPLE_STORIES.map((s) => (
          <li key={s.id} className="card flex w-[85%] shrink-0 snap-center flex-col p-5 sm:w-auto">
            <div className="flex items-center gap-3">
              <StoryArt art={s.art} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t(s.issue)}</p>
                <p className="text-[0.88rem] font-semibold text-mint-700">{t("welcome.stories.days", { d: num(s.days) })}</p>
              </div>
              <SampleChip />
            </div>
            <blockquote className="mt-4 flex-1 text-[1.02rem] leading-relaxed text-ink">
              <span aria-hidden className="mr-0.5 font-display text-[1.6rem] leading-none text-indigo-600">
                “
              </span>
              {t(s.quote)}
            </blockquote>
            <div className="mt-4 flex items-center gap-3">
              <InitialsAvatar name={t(s.name)} />
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{t(s.name)}</p>
                <p className="text-[0.88rem] text-ink-3">{t(s.place)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
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
