"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";

// Each status takes the pastel family of what it means (see globals.css).
const TONES: Record<string, string> = {
  draft: "bg-paper text-ink-2",
  queued: "bg-marigold-50 text-marigold-700",
  captured: "bg-sky-50 text-sky-700",
  reading: "bg-sky-50 text-sky-700",
  read: "bg-marigold-50 text-marigold-700 ring-1 ring-inset ring-marigold-200",
  read_failed: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  routed: "bg-mint-50 text-mint-700",
  in_progress: "bg-indigo-50 text-indigo-800",
  closed: "bg-ink text-white",
};

export function StatusTag({ status }: { status: string }) {
  const { t } = useI18n();
  const key = `status.${status}` as MessageKey;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[0.85rem] font-semibold leading-none ${TONES[status] ?? TONES.draft}`}>
      <span
        className={`h-2 w-2 rounded-full ${status === "reading" ? "animate-pulse bg-sky-500" : status === "routed" ? "bg-mint-500" : status === "read" || status === "queued" ? "bg-marigold-500" : status === "read_failed" ? "bg-red-500" : status === "closed" ? "bg-white" : "bg-current opacity-60"}`}
        aria-hidden
      />
      {t(key)}
    </span>
  );
}
