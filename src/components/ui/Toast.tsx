"use client";

import { useEffect, useState } from "react";
import { onToast, type ToastMessage } from "@/lib/client/toast";
import { Icon } from "./Icon";

const SHOW_MS = 2200;

/**
 * Shows toast() messages: a small dark pill at the bottom of the screen, above
 * the phone tab bar and the floating Scan button, for a couple of seconds. Announced to screen readers.
 */
export function Toaster() {
  const [msg, setMsg] = useState<ToastMessage | null>(null);
  useEffect(() => onToast(setMsg), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg((m) => (m?.id === msg.id ? null : m)), SHOW_MS);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(68px+16px+56px+12px+env(safe-area-inset-bottom))] lg:bottom-8 print:hidden"
    >
      {msg && (
        <p
          key={msg.id}
          className="toast-in flex max-w-md items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[0.95rem] font-medium text-white shadow-[var(--elevation-3)]"
        >
          <Icon name={msg.tone === "done" ? "check" : "alert"} size={18} className={msg.tone === "done" ? "text-mint-200" : "text-marigold-200"} />
          {msg.text}
        </p>
      )}
    </div>
  );
}
