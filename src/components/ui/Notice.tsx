import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "info" | "attention" | "error" | "done";

// Material 3 tonal containers: the tint and icon carry the meaning; no edge bar, no gradient.
const TONES: Record<Tone, { box: string; icon: IconName; iconCls: string }> = {
  info: { box: "bg-sky-50", icon: "info", iconCls: "text-sky-700" },
  attention: { box: "bg-marigold-50", icon: "alert", iconCls: "text-marigold-700" },
  error: { box: "bg-red-50", icon: "alert", iconCls: "text-red-600" },
  done: { box: "bg-mint-50", icon: "check", iconCls: "text-mint-700" },
};

/** Inline message on a tinted surface, with an icon for its meaning. */
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
    <div id={id} tabIndex={tabIndex} role={role} className={`flex gap-3 rounded-[var(--radius-panel)] p-4 ${t.box} ${className}`}>
      <Icon name={t.icon} className={`mt-0.5 ${t.iconCls}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-1 text-ink-2" : "text-ink-2"}>{children}</div>}
      </div>
    </div>
  );
}
