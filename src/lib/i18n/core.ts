// Translations: one ICU MessageFormat resource file per language in
// /messages (BCP 47 codes: mr, en, hi), read with use-intl (the core of
// next-intl). Shared by the browser and the server (SMS text).
// See messages/README.md for translators.

import { createTranslator, type MessageKeys, type NestedKeyOf, type TranslationValues } from "use-intl/core";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import mr from "../../../messages/mr.json";

export type Locale = "mr" | "en" | "hi";
export type Messages = typeof en;
/** Every leaf key of messages/en.json, e.g. "capture.title". */
export type MessageKey = MessageKeys<Messages, NestedKeyOf<Messages>>;

// English is the source language. Typing the others as `Messages` makes the
// build fail when a language file is missing a key (`npm run i18n:check` also
// reports extra keys and placeholder mismatches).
const MESSAGES: Record<Locale, Messages> = { mr, en, hi };

/** Each language is named in its own script (EC, USWDS, UX4G guidance). */
export const LOCALES: { code: Locale; name: string; tag: string }[] = [
  { code: "mr", name: "मराठी", tag: "mr-IN" },
  { code: "en", name: "English", tag: "en-IN" },
  { code: "hi", name: "हिन्दी", tag: "hi-IN" },
];

export const tagOf = (l: Locale) => LOCALES.find((x) => x.code === l)!.tag;

/**
 * Locale for number, date and plural formatting, with the digit system pinned
 * to Latin. Engines disagree on the default for Marathi: Node (server) uses
 * Devanagari digits (०), iOS WebKit uses Latin (0). Leaving it to the default
 * made the server HTML and the iPhone render differ — a React hydration error.
 * Latin digits also match what the Poppins typeface draws for both.
 */
export const formatTagOf = (l: Locale) => `${tagOf(l)}-u-nu-latn`;

type Translate = (key: MessageKey, values?: TranslationValues) => string;

const english = createTranslator({ locale: formatTagOf("en"), messages: en, timeZone: "Asia/Kolkata" });

const translators = Object.fromEntries(
  LOCALES.map(({ code }) => [
    code,
    createTranslator({
      locale: formatTagOf(code),
      messages: MESSAGES[code],
      timeZone: "Asia/Kolkata",
      onError: (e) => console.warn(`[i18n ${code}]`, e.message),
      // A missing or broken translation shows the English text, never a raw key.
      getMessageFallback: ({ key, namespace }) => {
        const full = (namespace ? `${namespace}.${key}` : key) as MessageKey;
        return (english as unknown as Translate)(full);
      },
    }) as unknown as Translate,
  ]),
) as Record<Locale, Translate>;

/** Translate outside React (server code, module-level data). */
export function translate(locale: Locale, key: MessageKey, values?: TranslationValues): string {
  return translators[locale](key, values);
}
