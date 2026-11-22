"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { StatTile } from "@/components/ui/StatTile";
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
          <h1 className="mt-0.5 text-[2.1rem] font-bold tracking-tight">{hydrated ? refLabel(v, locale) : " "}</h1>
          <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
            <StatTile tone="sky" value={nf(counts.today)} label={t("home.stat.today")} />
            <StatTile tone="peach" value={nf(counts.queued)} label={t("home.stat.toSync")} />
            <StatTile tone="violet" value={nf(counts.toVerify)} label={t("home.stat.toVerify")} href="/queue" />
          </div>
        </section>

        {draft && (
          <Link href="/capture" className="mb-4 block">
            <Notice tone="info" title={t("home.resume.title")}>
              {t("home.resume.body", { n: draft.page_count })}
            </Notice>
          </Link>
        )}

        <Button href="/capture" size="lg" block icon="camera" className="min-h-16 text-[1.15rem]">
          {t("home.scan")}
        </Button>
        <p className="mt-2 text-center text-[0.92rem] text-ink-3">{t("home.scan.hint")}</p>

        <ul className="mt-6 divide-y divide-rule overflow-hidden card">
          <Row href="/queue" icon="list" label="home.queue" count={counts.toVerify} chip="bg-sky-50 text-sky-700" />
          <Row href="/track" icon="search" label="home.track" chip="bg-indigo-50 text-indigo-800" />
        </ul>
      </Screen>
      <BottomNav />
    </>
  );
}

function Row({ href, icon, label, count, chip }: { href: string; icon: IconName; label: MessageKey; count?: number; chip: string }) {
  const { t } = useI18n();
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center gap-3 px-4 hover:bg-paper">
        <span className={`grid h-10 w-10 place-items-center rounded-full ${chip}`}>
          <Icon name={icon} size={20} />
        </span>
        <span className="flex-1 font-medium">{t(label)}</span>
        {!!count && <span className="rounded-full bg-marigold-50 px-2.5 py-0.5 text-[0.9rem] font-bold text-marigold-700">{count}</span>}
        <Icon name="next" className="text-ink-3" />
      </Link>
    </li>
  );
}
