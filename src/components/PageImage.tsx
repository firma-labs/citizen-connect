"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

const RETRIES = 3;

/**
 * A letter page from the server. If it fails to load (e.g. it was requested
 * while the phone was still uploading it), it retries with a fresh address —
 * Safari otherwise keeps showing the failed result for the same URL while the
 * app stays open — and finally offers a manual retry instead of a broken icon.
 */
export function PageImage(props: { src: string; className?: string; lazy?: boolean }) {
  // A new page address (rescan, upload finished) starts over with fresh state.
  return <Attempts key={props.src} {...props} />;
}

function Attempts({ src, className = "", lazy = false }: { src: string; className?: string; lazy?: boolean }) {
  const { t } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`grid place-items-center gap-1 bg-surface-container-high p-3 text-center text-[0.85rem] text-ink-3 ${className}`}>
        <span>{t("page.unavailable")}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setFailed(false);
              setAttempt((a) => a + 1);
            }
          }}
          className="inline-flex items-center gap-1 font-semibold text-primary"
        >
          <Icon name="refresh" size={16} />
          {t("page.retry")}
        </span>
      </span>
    );
  }

  const url = attempt ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
    <img
      key={url}
      src={url}
      alt=""
      loading={lazy ? "lazy" : undefined}
      className={className}
      onError={() => {
        if (attempt < RETRIES) setTimeout(() => setAttempt((a) => a + 1), 1500 * (attempt + 1));
        else setFailed(true);
      }}
    />
  );
}
