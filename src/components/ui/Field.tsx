"use client";

import type { ReactNode } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { Icon } from "./Icon";

export type Attention = "low" | "medium" | undefined;

export const inputClass = (attention?: Attention, invalid?: boolean) =>
  [
    "block w-full rounded-[var(--radius-control)] border-[1.5px] bg-surface px-4 py-3 text-ink shadow-[inset_0_1px_2px_rgb(28_31_51/0.04)]",
    "placeholder:text-ink-3 min-h-12",
    invalid ? "border-red-600" : attention === "low" ? "border-marigold-500 bg-marigold-50/50" : attention === "medium" ? "border-marigold-200" : "border-rule-strong",
  ].join(" ");

/**
 * Label above the control, optional English label beneath it, hint text, and
 * an attention message when the AI was unsure. Only uncertain fields say
 * anything — a clearly read field carries no badge.
 */
export function Field({
  id,
  label,
  hintKey,
  help,
  attention,
  error,
  children,
}: {
  id: string;
  label: MessageKey;
  hintKey?: MessageKey;
  help?: ReactNode;
  attention?: Attention;
  error?: ReactNode;
  children: ReactNode;
}) {
  const { t, hint } = useI18n();
  const en = hint(label);
  return (
    <div id={`field-${id}`} className={`scroll-mt-24 ${attention ? "-mx-3 rounded-[var(--radius-panel)] bg-gradient-to-br px-3 py-3 " + (attention === "low" ? "from-marigold-50 to-white" : "from-marigold-50/50 to-white") : ""}`}>
      <label htmlFor={id} className="block">
        <span className="block font-semibold text-ink">{t(label)}</span>
        {en && <span className="block text-[0.82rem] leading-snug text-ink-3">{en}</span>}
      </label>
      {hintKey && <p className="text-[0.9rem] text-ink-3">{t(hintKey)}</p>}
      {attention && (
        <p className="mt-1 flex items-center gap-1.5 text-[0.9rem] font-semibold text-marigold-700">
          <Icon name="alert" size={18} />
          {attention === "low" ? t("verify.check") : t("verify.probably")}
        </p>
      )}
      {error && (
        <p className="mt-1 flex items-center gap-1.5 text-[0.9rem] font-semibold text-red-600" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}
      <div className="mt-1.5">{children}</div>
      {help && <div className="mt-1.5 text-[0.9rem] text-ink-2">{help}</div>}
    </div>
  );
}

/** Section heading with an optional English label underneath. */
export function SectionTitle({ k, className = "" }: { k: MessageKey; className?: string }) {
  const { t, hint } = useI18n();
  const en = hint(k);
  return (
    <h2 className={`text-[1.2rem] font-semibold tracking-tight ${className}`}>
      {t(k)}
      {en && <span className="block text-[0.82rem] font-normal text-ink-3">{en}</span>}
    </h2>
  );
}
