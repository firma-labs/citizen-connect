"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { getDraft, listApps, subscribe, type LocalApplication } from "@/lib/client/db";
import { useSettings } from "@/lib/client/settings";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { refLabel, venue } from "@/lib/reference";

export default function Home() {
  const [settings, hydrated] = useSettings();
  const { t, date, locale } = useI18n();
  const [draft, setDraft] = useState<LocalApplication | undefined>();
  const [counts, setCounts] = useState({ queued: 0, toVerify: 0, today: 0 });
  // Read the clock on the device after load — the page shell is prerendered once.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = async () => {
      setDraft(await getDraft());
      setNow(new Date());
      const apps = await listApps();
      const today = new Date().toDateString();
      setCounts({
        queued: apps.filter((a) => a.state === "queued").length,
        toVerify: apps.filter((a) => a.server_status === "read" || a.server_status === "read_failed").length,
        today: apps.filter((a) => a.state !== "draft" && new Date(a.captured_at).toDateString() === today).length,
      });
    };
    refresh().catch(() => {});
    return subscribe(() => void refresh().catch(() => {}));
  }, []);

  const v = venue(settings.venue);
  const nf = (n: number) => new Intl.NumberFormat(locale === "en" ? "en-IN" : `${locale}-IN`).format(n);

  return (
    <>
      <AppBar />
      <Screen>
        {hydrated && !settings.staff && (
          <Link href="/settings" className="mb-5 block">
            <Notice tone="attention" title={t("home.setup.title")}>
              {t("home.setup.body")}
            </Notice>
          </Link>
        )}

        <section aria-labelledby="today" className="mb-6">
          <p id="today" className="text-ink-3">
            {t("home.today")}
            {now && <> · {date(now, { weekday: "long", day: "numeric", month: "long" })}</>}
          </p>
          <h1 className="mt-0.5 text-[2.1rem] font-extrabold tracking-tight">{hydrated ? refLabel(v, locale) : " "}</h1>
          <dl className="mt-4 grid grid-cols-3 divide-x divide-rule rounded-[var(--radius-panel)] border border-rule bg-surface">
            <Stat value={nf(counts.today)} label="home.stat.today" />
            <Stat value={nf(counts.queued)} label="home.stat.toSync" attention={counts.queued > 0} />
            <Stat value={nf(counts.toVerify)} label="home.stat.toVerify" attention={counts.toVerify > 0} href="/queue" />
          </dl>
        </section>

        {draft && (
          <Link href="/capture" className="mb-4 block">
            <Notice tone="info" title={t("home.resume.title")}>
              {t("home.resume.body", { n: draft.page_count })}
            </Notice>
          </Link>
        )}

        <Button href="/capture" size="lg" block icon="camera" className="min-h-16 text-[1.2rem]">
          {t("home.scan")}
        </Button>
        <p className="mt-2 text-center text-[0.92rem] text-ink-3">{t("home.scan.hint")}</p>

        <ul className="mt-6 divide-y divide-rule overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-surface">
          <Row href="/queue" icon="list" label="home.queue" count={counts.toVerify} />
          <Row href="/track" icon="search" label="home.track" />
        </ul>
      </Screen>
      <BottomNav />
    </>
  );
}

function Stat({ value, label, attention, href }: { value: string; label: MessageKey; attention?: boolean; href?: string }) {
  const { t } = useI18n();
  const body = (
    <>
      <dt className="mt-1.5 text-[0.85rem] leading-snug text-ink-2">{t(label)}</dt>
      <dd className={`text-[1.9rem] font-extrabold leading-none ${attention ? "text-marigold-700" : "text-ink"}`}>{value}</dd>
    </>
  );
  // <dl> may only hold <div> groups, so a linked stat uses a stretched link over the group.
  return (
    <div className="relative flex flex-col-reverse justify-end p-3.5">
      {body}
      {href && <Link href={href} aria-label={t(label)} className="absolute inset-0 rounded-[var(--radius-panel)]" />}
    </div>
  );
}

function Row({ href, icon, label, count }: { href: string; icon: IconName; label: MessageKey; count?: number }) {
  const { t } = useI18n();
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center gap-3 px-4 hover:bg-paper">
        <Icon name={icon} className="text-indigo-700" />
        <span className="flex-1 font-semibold">{t(label)}</span>
        {!!count && <span className="rounded-full bg-marigold-50 px-2.5 py-0.5 text-[0.9rem] font-bold text-marigold-700">{count}</span>}
        <Icon name="next" className="text-ink-3" />
      </Link>
    </li>
  );
}
