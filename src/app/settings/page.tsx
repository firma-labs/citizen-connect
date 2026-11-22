"use client";

import { useEffect, useState } from "react";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Field, SectionTitle, inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { saveSettings, useSettings } from "@/lib/client/settings";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";
import { VENUES, refLabel } from "@/lib/reference";

export default function SettingsPage() {
  const [s, hydrated] = useSettings();
  const { t, hint, locale, setLocale } = useI18n();
  const [staff, setStaff] = useState("");
  const [savedName, setSavedName] = useState(false);
  const [health, setHealth] = useState<Record<string, string> | null | undefined>(undefined);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the input once settings load from storage
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
      <AppBar />
      <Screen>
        <h1 className="mb-6 text-[1.7rem] font-extrabold">{t("settings.title")}</h1>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings({ staff: staff.trim() });
            setSavedName(true);
          }}
        >
          <Field id="staff" label="settings.staff" hintKey="settings.staff.hint">
            <div className="flex gap-2">
              <input
                id="staff"
                value={staff}
                onChange={(e) => {
                  setStaff(e.target.value);
                  setSavedName(false);
                }}
                required
                autoComplete="name"
                className={inputClass()}
              />
              <Button type="submit" variant={savedName ? "secondary" : "primary"} icon={savedName ? "check" : undefined} className="shrink-0 whitespace-nowrap">
                {savedName ? t("settings.saved") : t("settings.save")}
              </Button>
            </div>
          </Field>
        </form>

        <Choice
          className="mt-8"
          title="settings.venue"
          value={s.venue}
          onChange={(v) => saveSettings({ venue: v })}
          options={VENUES.map((v) => ({ value: v.code, label: refLabel(v, locale) }))}
        />

        <Choice
          className="mt-8"
          title="settings.language"
          value={locale}
          onChange={(v) => setLocale(v as typeof locale)}
          options={LOCALES.map((l) => ({ value: l.code, label: l.name, lang: l.tag }))}
        />

        <div className="mt-8 divide-y divide-rule rounded-[var(--radius-panel)] border border-rule bg-surface">
          {locale !== "en" && <Toggle label="settings.hints" help="settings.hints.hint" checked={s.hints} onChange={(v) => saveSettings({ hints: v })} />}
          <Toggle label="settings.autoCrop" help="settings.autoCrop.hint" checked={s.autoCrop} onChange={(v) => saveSettings({ autoCrop: v })} />
          <Toggle label="settings.live" help="settings.live.hint" checked={s.liveCamera} onChange={(v) => saveSettings({ liveCamera: v })} />
        </div>

        <section className="mt-10">
          <SectionTitle k="settings.system" />
          {health === null ? (
            <Notice tone="attention" className="mt-3">
              {t("settings.offline")}
            </Notice>
          ) : (
            <dl className="mt-3 divide-y divide-rule rounded-[var(--radius-panel)] border border-rule bg-surface">
              {(
                [
                  ["settings.store", health?.store],
                  ["settings.reader", health?.reader],
                  ["settings.reasoner", health?.reasoner],
                  ["settings.sms", health?.sms],
                ] as [MessageKey, string | undefined][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-ink-2">
                    {t(k)}
                    {hint(k) && <span className="block text-[0.8rem] text-ink-3">{hint(k)}</span>}
                  </dt>
                  <dd className="break-all text-right font-semibold">{v ?? "…"}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 flex items-start gap-2 text-[0.9rem] text-ink-3">
            <Icon name="info" size={18} className="mt-0.5" />
            {t("settings.pilot")}
          </p>
        </section>
      </Screen>
      <BottomNav />
    </>
  );
}

function Choice({
  title,
  value,
  onChange,
  options,
  className = "",
}: {
  title: MessageKey;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; lang?: string }[];
  className?: string;
}) {
  const { t, hint } = useI18n();
  return (
    <fieldset className={className}>
      <legend className="font-semibold">
        {t(title)}
        {hint(title) && <span className="block text-[0.82rem] font-normal text-ink-3">{hint(title)}</span>}
      </legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              lang={o.lang}
              className={`flex min-h-14 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2 text-center font-semibold leading-tight has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-focus ${on ? "bg-indigo-700 text-white" : "bg-surface text-ink ring-1 ring-inset ring-rule-strong"}`}
            >
              <input type="radio" name={title} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {on && <Icon name="check" size={18} />}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Toggle({ label, help, checked, onChange }: { label: MessageKey; help: MessageKey; checked: boolean; onChange: (v: boolean) => void }) {
  const { t, hint } = useI18n();
  const id = `toggle-${label}`;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block font-semibold">{t(label)}</span>
        {hint(label) && <span className="block text-[0.8rem] text-ink-3">{hint(label)}</span>}
        <span className="mt-0.5 block text-[0.9rem] text-ink-3">{t(help)}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-indigo-700" : "bg-rule-strong"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}
