"use client";

import { useCallback, useEffect } from "react";
import { saveSettings, useSettings } from "@/lib/client/settings";
import { MESSAGES, type MessageKey } from "./messages";

export type Locale = "mr" | "en" | "hi";
export type { MessageKey };

/** Each language is named in its own script (EC, USWDS, UX4G guidance). */
export const LOCALES: { code: Locale; name: string; tag: string }[] = [
  { code: "mr", name: "मराठी", tag: "mr-IN" },
  { code: "en", name: "English", tag: "en-IN" },
  { code: "hi", name: "हिन्दी", tag: "hi-IN" },
];

const tagOf = (l: Locale) => LOCALES.find((x) => x.code === l)!.tag;

/**
 * Locale for number and date formatting, with the digit system pinned to Latin.
 * Engines disagree on the default for Marathi: Node (server) uses Devanagari
 * digits (०), iOS WebKit uses Latin (0). Leaving it to the default made the
 * server HTML and the iPhone render differ — a React hydration error. Latin
 * digits also match what the Poppins typeface draws for both.
 */
const formatTagOf = (l: Locale) => `${tagOf(l)}-u-nu-latn`;

function format(template: string, vars: Record<string, string | number> | undefined, formatTag: string) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    if (v === undefined) return `{${k}}`;
    return typeof v === "number" ? new Intl.NumberFormat(formatTag).format(v) : v;
  });
}

export function useI18n() {
  const [settings, hydrated] = useSettings();
  const locale = (settings.locale ?? "mr") as Locale;
  const tag = tagOf(locale);
  const formatTag = formatTagOf(locale);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => format(MESSAGES[locale][key] ?? MESSAGES.en[key], vars, formatTag),
    [locale, formatTag],
  );
  /** English text shown under a label when "Show English labels" is on (PRD §10). */
  const hint = useCallback(
    (key: MessageKey) => (settings.hints && locale !== "en" ? MESSAGES.en[key] : null),
    [settings.hints, locale],
  );
  const date = useCallback(
    (iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) =>
      new Intl.DateTimeFormat(formatTag, opts).format(typeof iso === "string" ? new Date(iso) : iso),
    [formatTag],
  );
  /** Format a number the same way on the server and every browser. */
  const num = useCallback((n: number) => new Intl.NumberFormat(formatTag).format(n), [formatTag]);
  const setLocale = useCallback((l: Locale) => saveSettings({ locale: l }), []);

  return { t, hint, date, num, locale, tag, setLocale, hydrated };
}

/** Keeps <html lang> in sync so screen readers and fonts use the right language. */
export function useHtmlLang() {
  const { tag } = useI18n();
  useEffect(() => {
    document.documentElement.lang = tag.split("-")[0];
  }, [tag]);
}
