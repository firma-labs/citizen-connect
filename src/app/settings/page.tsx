"use client";

import { useEffect, useState } from "react";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Field, SectionTitle, inputClass } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { saveSettings, useSettings } from "@/lib/client/settings";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";

type Tab = "account" | "app" | "system";
const TABS: { id: Tab; label: MessageKey }[] = [
  { id: "account", label: "settings.tab.account" },
  { id: "app", label: "settings.tab.app" },
  { id: "system", label: "settings.tab.system" },
];

/**
 * Settings in three groups (Material 3 tabs): who is signed in; how the app
 * looks and scans on this phone; and the system check. The Darbar venue is not
 * here — it belongs to the session and is chosen on Home and Scan.
 */
export default function SettingsPage() {
  const [s, hydrated] = useSettings();
  const { t, hint, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<Tab>("account");
  const [staff, setStaff] = useState("");
  const [savedName, setSavedName] = useState(false);
  const [health, setHealth] = useState<{ store: string; reader: string; reasoner: string; sms: string; ai_today?: { user: number; userLimit: number; total: number; totalLimit: number } } | null | undefined>(undefined);
  const [me, setMe] = useState<{ mode: string; signedIn: boolean; mobile: string | null; name: string | null } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the input once settings load from storage
    if (hydrated) setStaff(s.staff);
  }, [hydrated, s.staff]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe(null));
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <>
      <AppBar title="nav.settings" back="/" />
      <Screen>
        <h1 className="mb-4 text-[1.7rem] font-bold tracking-tight">{t("settings.title")}</h1>

        {/* Material 3 primary tabs */}
        <div role="tablist" aria-label={t("settings.title")} className="mb-6 grid grid-cols-3 border-b border-rule-strong">
          {TABS.map((x) => {
            const on = tab === x.id;
            return (
              <button
                key={x.id}
                role="tab"
                id={`tab-${x.id}`}
                aria-selected={on}
                aria-controls={`panel-${x.id}`}
                onClick={() => setTab(x.id)}
                className={`relative min-h-12 px-2 font-semibold transition-colors ${on ? "text-primary" : "text-ink-3 hover:bg-ink/5 hover:text-ink"}`}
              >
                {t(x.label)}
                {on && <span aria-hidden className="absolute inset-x-6 bottom-0 h-[3px] rounded-t-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {tab === "account" && (
          <div role="tabpanel" id="panel-account" aria-labelledby="tab-account" className="space-y-6">
            {me?.signedIn && (
              <div className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-[0.85rem] text-ink-3">{t("settings.account")}</p>
                  <p className="truncate font-semibold">{me.name ?? me.mobile}</p>
                  {me.name && <p className="text-[0.9rem] text-ink-3">+91 {me.mobile}</p>}
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
                    window.location.replace("/login");
                  }}
                >
                  {t("settings.signOut")}
                </Button>
              </div>
            )}
            {/* Without sign-in (local use), staff type the name recorded with their work. */}
            {me && !me.signedIn && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveSettings({ staff: staff.trim() });
                  setSavedName(true);
                }}
              >
                <Field id="staff" label="settings.staff.label" hintKey="settings.staff.hint">
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
            )}
          </div>
        )}

        {tab === "app" && (
          <div role="tabpanel" id="panel-app" aria-labelledby="tab-app" className="space-y-8">
            <Choice
              title="settings.language"
              value={locale}
              onChange={(v) => setLocale(v as typeof locale)}
              options={LOCALES.map((l) => ({ value: l.code, label: l.name, lang: l.tag }))}
            />
            <div>
              <Choice
                title="settings.textSize.label"
                value={String(s.textScale ?? 1)}
                onChange={(v) => saveSettings({ textScale: Number(v) })}
                options={[
                  { value: "1", label: t("settings.textSize.default") },
                  { value: "1.15", label: t("settings.textSize.large") },
                  { value: "1.3", label: t("settings.textSize.larger") },
                ]}
              />
              <p className="mt-2 text-[0.9rem] text-ink-3">{t("settings.textSize.hint")}</p>
            </div>
            <section>
              <SectionTitle k="settings.group.display" />
              <div className="mt-3 divide-y divide-surface card">
                {locale !== "en" ? (
                  <Toggle label="settings.hints.label" help="settings.hints.hint" checked={s.hints} onChange={(v) => saveSettings({ hints: v })} />
                ) : (
                  <p className="px-4 py-4 text-[0.92rem] text-ink-3">{t("settings.hints.englishOnly")}</p>
                )}
              </div>
            </section>
            <section>
              <SectionTitle k="settings.group.scanning" />
              <div className="mt-3 divide-y divide-surface card">
                <Toggle label="settings.autoCrop.label" help="settings.autoCrop.hint" checked={s.autoCrop} onChange={(v) => saveSettings({ autoCrop: v })} />
                <Toggle
                  label="settings.samples.label"
                  help="settings.samples.hint"
                  checked={s.showSamples !== false}
                  onChange={(v) => saveSettings({ showSamples: v })}
                />
              </div>
            </section>
          </div>
        )}

        {tab === "system" && (
          <section role="tabpanel" id="panel-system" aria-labelledby="tab-system">
            {health === null ? (
              <Notice tone="attention">{t("settings.offline")}</Notice>
            ) : (
              <dl className="divide-y divide-surface card">
                {(
                  [
                    ["settings.store", health?.store],
                    ["settings.reader", health?.reader],
                    ["settings.reasoner", health?.reasoner],
                    ["settings.sms", health?.sms],
                    ["settings.aiToday", health?.ai_today ? `${health.ai_today.user} / ${health.ai_today.userLimit}` : undefined],
                    [
                      "settings.aiTotal",
                      health?.ai_today ? `${health.ai_today.total}${health.ai_today.totalLimit ? ` / ${health.ai_today.totalLimit}` : ""}` : undefined,
                    ],
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
        )}
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
      {/* Material 3 segmented button: one outline, the selected segment filled with a check */}
      <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-[var(--radius-button)] border border-line">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              lang={o.lang}
              className={`flex min-h-12 cursor-pointer items-center justify-center gap-1.5 border-line px-2 text-center font-semibold leading-tight transition-colors [&:not(:first-child)]:border-l has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-ink ${on ? "bg-primary-container text-on-primary-container" : "text-ink-2 hover:bg-primary/8"}`}
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
        className={`relative h-8 w-[3.25rem] shrink-0 rounded-full border-2 transition-colors ${checked ? "border-primary bg-primary" : "border-line bg-surface-container-high"}`}
      >
        {/* Material 3 switch: small outlined thumb when off, large white thumb with a check when on */}
        <span
          className={`absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full transition-all ${checked ? "left-[1.375rem] h-6 w-6 bg-white text-primary" : "left-1.5 h-4 w-4 bg-line"}`}
        >
          {checked && <Icon name="check" size={16} />}
        </span>
      </button>
    </div>
  );
}
