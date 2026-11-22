"use client";

import { useI18n, type MessageKey } from "@/lib/i18n";

const TONES: Record<string, string> = {
  draft: "bg-paper text-ink-2 ring-1 ring-rule-strong",
  queued: "bg-paper text-ink-2 ring-1 ring-rule-strong",
  captured: "bg-indigo-50 text-indigo-800",
  reading: "bg-indigo-50 text-indigo-800",
  read: "bg-marigold-50 text-marigold-700 ring-1 ring-marigold-500",
  read_failed: "bg-red-50 text-red-700 ring-1 ring-red-600",
  routed: "bg-indigo-700 text-white",
  in_progress: "bg-indigo-100 text-indigo-900",
  closed: "bg-ink text-white",
};

export function StatusTag({ status }: { status: string }) {
  const { t } = useI18n();
  const key = `status.${status}` as MessageKey;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[0.85rem] font-semibold leading-none ${TONES[status] ?? TONES.draft}`}>
      {status === "reading" && <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" aria-hidden />}
      {t(key)}
    </span>
  );
}
