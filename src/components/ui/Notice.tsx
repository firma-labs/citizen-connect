import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "info" | "attention" | "error" | "done";

const TONES: Record<Tone, { box: string; icon: IconName; iconCls: string }> = {
  info: { box: "bg-indigo-50 border-indigo-600", icon: "info", iconCls: "text-indigo-700" },
  attention: { box: "bg-marigold-50 border-marigold-500", icon: "alert", iconCls: "text-marigold-700" },
  error: { box: "bg-red-50 border-red-600", icon: "alert", iconCls: "text-red-600" },
  done: { box: "bg-indigo-50 border-indigo-700", icon: "check", iconCls: "text-indigo-700" },
};

/** Inline message with a coloured left edge — the edge carries the meaning, not decoration. */
export function Notice({
  tone = "info",
  title,
  children,
  role,
  className = "",
  id,
  tabIndex,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  className?: string;
  id?: string;
  tabIndex?: number;
}) {
  const t = TONES[tone];
  return (
    <div id={id} tabIndex={tabIndex} role={role} className={`flex gap-3 rounded-[var(--radius-control)] border-l-[5px] p-4 ${t.box} ${className}`}>
      <Icon name={t.icon} className={`mt-0.5 ${t.iconCls}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1 text-ink-2" : "text-ink-2"}>{children}</div>}
      </div>
    </div>
  );
}
