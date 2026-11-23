"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";

// Each status takes the pastel family of what it means (see globals.css):
// sky = with the department, violet = being worked on, mint = resolved,
// peach = needs a person here, rose = failed or overdue.
const TONES: Record<string, { tag: string; dot: string }> = {
  draft: { tag: "bg-paper text-ink-2", dot: "bg-current opacity-60" },
  queued: { tag: "bg-marigold-50 text-marigold-700", dot: "bg-marigold-500" },
  captured: { tag: "bg-sky-50 text-sky-700", dot: "bg-current opacity-60" },
  reading: { tag: "bg-sky-50 text-sky-700", dot: "animate-pulse bg-sky-500" },
  read: { tag: "bg-marigold-50 text-marigold-700", dot: "bg-marigold-500" },
  read_failed: { tag: "bg-red-50 text-red-700", dot: "bg-red-500" },
  routed: { tag: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  acknowledged: { tag: "bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  in_progress: { tag: "bg-indigo-50 text-indigo-800", dot: "bg-indigo-600" },
  closed: { tag: "bg-mint-50 text-mint-700", dot: "bg-mint-500" },
  overdue: { tag: "bg-red-50 text-red-700", dot: "bg-red-500" },
};

/** Status chip. `overdue` marks an open application past its department's response time. */
export function StatusTag({ status, overdue = false }: { status: string; overdue?: boolean }) {
  const { t } = useI18n();
  const tone = TONES[overdue ? "overdue" : status] ?? TONES.draft;
  const label = t(`status.${status}` as MessageKey);
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[0.85rem] font-semibold leading-none ${tone.tag}`}>
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden />
      {overdue ? t("status.overdue", { status: label }) : label}
    </span>
  );
}
