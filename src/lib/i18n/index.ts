"use client";

import { useCallback, useEffect } from "react";
import { saveSettings, useSettings } from "@/lib/client/settings";
import type { TranslationValues } from "use-intl/core";
import { LOCALES, formatTagOf, tagOf, translate, type Locale, type MessageKey } from "./core";

export { LOCALES, translate };
export type { Locale, MessageKey };

export function useI18n() {
  const [settings, hydrated] = useSettings();
  const locale = (settings.locale ?? "mr") as Locale;
  const tag = tagOf(locale);
  const formatTag = formatTagOf(locale);

  const t = useCallback((key: MessageKey, values?: TranslationValues) => translate(locale, key, values), [locale]);
  /** English text shown under a label when "Show English labels" is on (PRD §10). */
  const hint = useCallback(
    (key: MessageKey) => (settings.hints && locale !== "en" ? translate("en", key) : null),
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
