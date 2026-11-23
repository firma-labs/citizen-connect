"use client";

import { useSyncExternalStore } from "react";

// Per-device conveniences (staff name, venue, capture options).
export interface Settings {
  staff: string;
  venue: string;
  autoCrop: boolean;
  /** Show the sample letters on the Scan screen (demos and testing). */
  showSamples: boolean;
  /** Text size on this phone, on top of the phone's own setting: 1, 1.15 or 1.3. */
  textScale: number;
  locale: "mr" | "en" | "hi";
  /** Show the English label under each field when the UI is in Marathi or Hindi. */
  hints: boolean;
}

const KEY = "cc-settings";
const DEFAULTS: Settings = {
  staff: "",
  venue: "TH",
  autoCrop: true,
  textScale: 1,
  showSamples: true,
  locale: "mr",
  hints: true,
};

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache!;
}

export function saveSettings(patch: Partial<Settings>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  listeners.forEach((l) => l());
}

export function useSettings(): [Settings, boolean] {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULTS,
  );
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return [s, hydrated];
}
