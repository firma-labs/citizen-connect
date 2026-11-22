"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BigButton, Header, Page } from "@/components/Header";
import { saveSettings, useSettings } from "@/lib/client/settings";
import { VENUES } from "@/lib/reference";

export default function SettingsPage() {
  const [s, hydrated] = useSettings();
  const router = useRouter();
  const [staff, setStaff] = useState("");
  const [health, setHealth] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the input once settings load
    if (hydrated) setStaff(s.staff);
  }, [hydrated, s.staff]);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <>
      <Header title="सेटिंग्ज · Settings" back="/" />
      <Page>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings({ staff: staff.trim() });
            router.push("/");
          }}
        >
          <label className="block">
            <span className="font-bold">कर्मचारी नाव · Staff name</span>
            <input
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              required
              className="mt-1 block w-full rounded-xl border-2 border-line bg-white px-4 py-3"
              placeholder="e.g. R. Jadhav"
            />
            <span className="text-sm text-muted">Recorded against every token and every edit (audit log).</span>
          </label>

          <fieldset>
            <legend className="font-bold">दरबार ठिकाण · Darbar venue</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {VENUES.map((v) => (
                <button
                  type="button"
                  key={v.code}
                  onClick={() => saveSettings({ venue: v.code })}
                  className={`rounded-xl border-2 px-2 py-3 font-semibold ${s.venue === v.code ? "border-forest-700 bg-forest-700 text-white" : "border-line bg-white"}`}
                >
                  <div>{v.mr}</div>
                  <div className="text-xs opacity-80">{v.name}</div>
                </button>
              ))}
            </div>
          </fieldset>

          <Toggle
            checked={s.autoCrop}
            onChange={(v) => saveSettings({ autoCrop: v })}
            mr="कडा आपोआप कापा"
            en="Auto-crop to paper edges"
          />
          <Toggle
            checked={s.liveCamera}
            onChange={(v) => saveSettings({ liveCamera: v })}
            mr="थेट कॅमेरा (मार्गदर्शक रेषा)"
            en="Live camera view with edge guides (optional)"
          />

          <BigButton type="submit" mr="जतन करा" en="Save" />
        </form>

        <section className="mt-8 rounded-2xl bg-white p-4 text-sm shadow-sm">
          <div className="mb-2 font-bold">System check · प्रणाली तपासणी</div>
          {health ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">Store</dt><dd>{health.store}</dd>
              <dt className="text-muted">AI reader</dt><dd>{health.reader}</dd>
              <dt className="text-muted">AI reasoner</dt><dd>{health.reasoner}</dd>
              <dt className="text-muted">SMS</dt><dd>{health.sms}</dd>
            </dl>
          ) : (
            <p className="text-muted">Server not reachable (offline?) — capture still works and will sync later.</p>
          )}
          <p className="mt-3 text-muted">
            Pilot build: mock or redacted letters only. Do not capture real citizen applications on this server.
          </p>
        </section>
      </Page>
    </>
  );
}

function Toggle({ checked, onChange, mr, en }: { checked: boolean; onChange: (v: boolean) => void; mr: string; en: string }) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-xl border-2 border-line bg-white px-4 py-3">
      <span>
        <span className="block font-bold">{mr}</span>
        <span className="block text-sm text-muted">{en}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-7 w-7 accent-forest-700" />
    </label>
  );
}
