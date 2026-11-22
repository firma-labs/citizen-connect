"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BigButton, Header, Page } from "@/components/Header";
import { getDraft, listApps, subscribe, type LocalApplication } from "@/lib/client/db";
import { useSettings } from "@/lib/client/settings";
import { venue } from "@/lib/reference";

export default function Home() {
  const [settings, hydrated] = useSettings();
  const [draft, setDraft] = useState<LocalApplication | undefined>();
  const [counts, setCounts] = useState({ queued: 0, toVerify: 0, today: 0 });

  useEffect(() => {
    const refresh = async () => {
      setDraft(await getDraft());
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

  return (
    <>
      <Header />
      <Page>
        {hydrated && !settings.staff && (
          <Link href="/settings" className="mb-4 block rounded-2xl border-2 border-warn-500 bg-warn-50 p-4">
            <b>तुमचे नाव व ठिकाण नोंदवा</b>
            <div className="text-sm">Set your name and Darbar venue before starting →</div>
          </Link>
        )}

        <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-sm text-muted">आजचा दरबार · Today&apos;s Darbar</div>
          <div className="text-2xl font-extrabold">{hydrated ? `${v?.mr ?? ""} · ${v?.name ?? ""}` : " "}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat n={counts.today} mr="आज" en="Today" />
            <Stat n={counts.queued} mr="पाठवणे बाकी" en="To sync" warn={counts.queued > 0} />
            <Stat n={counts.toVerify} mr="तपासणे" en="To verify" warn={counts.toVerify > 0} />
          </div>
        </section>

        {draft && (
          <Link href="/capture" className="mb-4 block rounded-2xl border-2 border-forest-600 bg-forest-50 p-4">
            <b>अपूर्ण अर्ज सुरू ठेवा</b> · Resume unfinished capture
            <div className="text-sm text-muted">{draft.page_count} page(s) already photographed</div>
          </Link>
        )}

        <div className="space-y-3">
          <BigButton href="/capture" mr="नवीन अर्ज स्कॅन करा" en="Scan new application" />
          <BigButton href="/queue" variant="secondary" mr="अर्ज यादी व तपासणी" en="Queue & verification" />
          <BigButton href="/track" variant="secondary" mr="अर्जाची स्थिती" en="Track an application" />
        </div>

        <div className="mt-6 text-center">
          <Link href="/settings" className="text-forest-700 underline underline-offset-4">
            सेटिंग्ज · Settings{hydrated && settings.staff ? ` (${settings.staff})` : ""}
          </Link>
        </div>
      </Page>
    </>
  );
}

function Stat({ n, mr, en, warn }: { n: number; mr: string; en: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-2 ${warn ? "bg-warn-50" : "bg-forest-50"}`}>
      <div className="text-2xl font-extrabold">{n}</div>
      <div className="text-xs font-semibold leading-tight">{mr}</div>
      <div className="text-[11px] text-muted leading-tight">{en}</div>
    </div>
  );
}
