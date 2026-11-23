"use client";

import { saveSettings, useSettings } from "@/lib/client/settings";
import { useI18n } from "@/lib/i18n";
import { VENUES, refLabel } from "@/lib/reference";
import { Icon } from "./ui/Icon";

/**
 * Today's Darbar venue — part of the session, not a setting. Remembered on this
 * phone so staff pick it once per Darbar; tokens issued here carry its code.
 * `large` renders it as the Home screen's heading.
 */
export function VenuePicker({
  large = false,
  beforeChange,
  disabled = false,
}: {
  large?: boolean;
  /** Runs (and is awaited) before the new venue is saved. */
  beforeChange?: (code: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [settings, hydrated] = useSettings();
  const { t, locale } = useI18n();
  return (
    <label className={`relative inline-flex max-w-full items-center ${large ? "" : "rounded-[var(--radius-control)] bg-surface-container transition-colors hover:bg-surface-container-high"}`}>
      <span className="sr-only">{t("settings.venue")}</span>
      <select
        value={hydrated ? settings.venue : ""}
        disabled={disabled}
        onChange={async (e) => {
          const code = e.target.value;
          await beforeChange?.(code);
          saveSettings({ venue: code });
        }}
        // Inline size: the global 16px rule for form controls (stops iOS zoom) would otherwise win.
        style={{ fontSize: large ? "2.1rem" : "0.98rem" }}
        className={`max-w-full cursor-pointer appearance-none truncate bg-transparent font-bold text-ink disabled:cursor-default disabled:opacity-60 ${
          large ? "rounded-[var(--radius-control)] py-0.5 pr-10 leading-tight tracking-tight hover:bg-ink/5" : "h-10 pl-3 pr-9"
        }`}
      >
        {!hydrated && <option value="">…</option>}
        {VENUES.map((v) => (
          <option key={v.code} value={v.code}>
            {refLabel(v, locale)}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={large ? 28 : 20} className={`pointer-events-none absolute text-ink-2 ${large ? "right-1" : "right-2.5"}`} />
    </label>
  );
}
