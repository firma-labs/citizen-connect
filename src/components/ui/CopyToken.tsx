"use client";

import { useState } from "react";
import { copyText, toast } from "@/lib/client/toast";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * Small copy button for a token number, placed right after it. Copies the
 * token and confirms with a toast. Safe inside a tappable card or a link: the
 * tap copies and does nothing else. Hidden when printing (the token slip).
 */
export function CopyToken({ token, size = 18, className = "" }: { token: string; size?: number; className?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={t("token.copy", { token })}
      title={t("token.copy", { token })}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (await copyText(token)) {
          toast(t("token.copied", { token }));
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } else {
          toast(t("token.copyFailed"), "error");
        }
      }}
      className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-ink/5 hover:text-ink active:bg-ink/10 print:hidden ${className}`}
    >
      <Icon name={done ? "check" : "copy"} size={size} className={done ? "text-mint-700" : ""} />
    </button>
  );
}
