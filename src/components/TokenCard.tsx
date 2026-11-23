"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/client/settings";
import { translate, useI18n } from "@/lib/i18n";
import { refLabel, venue } from "@/lib/reference";

/**
 * The acknowledgement slip (पोच पावती) the citizen photographs (PRD §4.1 #3).
 * Styled after a stamped government receipt: perforated edge, the token set
 * large, and a seal. Citizen instructions always include Marathi.
 */
export function TokenCard({ token, pages, issuedAt }: { token: string; pages?: number; issuedAt?: string }) {
  const { t, locale, date } = useI18n();
  const [settings] = useSettings();
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [when, setWhen] = useState<Date | null>(issuedAt ? new Date(issuedAt) : null);

  useEffect(() => {
    const u = `${window.location.origin}/track?t=${encodeURIComponent(token)}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- origin is only known in the browser
    setUrl(u);
    if (!issuedAt) setWhen(new Date());
    QRCode.toDataURL(u, { errorCorrectionLevel: "Q", margin: 1, width: 560, color: { dark: "#1b1e2e", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [token, issuedAt]);

  const v = venue(token.slice(0, 2)) ?? venue(settings.venue);

  return (
    <article
      className="relative mx-auto max-w-md overflow-hidden rounded-b-[var(--radius-panel)] bg-surface pt-3 shadow-[0_18px_40px_-22px_rgb(28_31_51/0.45)]"
      style={{
        // Perforated tear-off top edge, cut out of the slip itself.
        WebkitMask: "radial-gradient(circle at 8px 0, transparent 6px, #000 6.5px) 0 0 / 16px 12px repeat-x, linear-gradient(#000, #000) 0 12px / 100% calc(100% - 12px) no-repeat",
        mask: "radial-gradient(circle at 8px 0, transparent 6px, #000 6.5px) 0 0 / 16px 12px repeat-x, linear-gradient(#000, #000) 0 12px / 100% calc(100% - 12px) no-repeat",
      }}
    >
      <Seal className="absolute right-3 top-7 h-[5.5rem] w-[5.5rem] rotate-[-12deg]" />
      <div className="px-6 pb-6 pt-3 text-center [container-type:inline-size]">
        {/* Receipt header on the left, the office seal beside it */}
        <div className="min-h-20 pr-24 text-left">
          <p className="text-[1.1rem] font-bold text-indigo-800">{t("token.receipt")}</p>
          <p className="text-[0.85rem] leading-snug text-ink-3">
            {t("app.name")} · {refLabel(v, locale)}
            {when && (
              <span className="block">{date(when, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            )}
          </p>
        </div>

        <p className="mt-3 text-[0.95rem] text-ink-2">{t("token.yourToken")}</p>
        {/* Sized to the slip's own width (container query), so the token never clips. */}
        <p className="token mt-1 whitespace-nowrap text-[clamp(1.35rem,10.5cqi,2.6rem)] leading-none tracking-[0.02em] text-ink">{token}</p>

        <div className="relative mx-auto mt-5 w-full max-w-[16rem]">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL
            <img src={qr} alt={`QR: ${token}`} className="aspect-square w-full" />
          ) : (
            <div className="aspect-square w-full animate-pulse rounded-lg bg-paper" />
          )}
        </div>

        <p className="mt-6 text-left text-[1rem] leading-relaxed">{t("token.citizen")}</p>
        {locale !== "mr" && (
          <p lang="mr" className="mt-2 text-left text-[1rem] leading-relaxed text-ink-2">
            {translate("mr", "token.citizen")}
          </p>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-dashed border-rule-strong pt-3 text-[0.85rem] text-ink-3">
          <span>{pages ? t("token.pages", { n: pages }) : " "}</span>
          <span className="truncate pl-3">{url.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
    </article>
  );
}

/** Circular office seal in stamp-pad indigo. */
function Seal({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={`pointer-events-none text-indigo-700 opacity-80 mix-blend-multiply ${className}`} aria-hidden>
      <defs>
        <path id="seal-arc" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="60" r="34" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fill="currentColor" fontSize="11.5" fontWeight="700" letterSpacing="1.5">
        <textPath href="#seal-arc" startOffset="0">
          {translate("mr", "seal.ring")}
        </textPath>
      </text>
      <text x="60" y="58" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="800">
        {translate("mr", "seal.received")}
      </text>
      <text x="60" y="75" textAnchor="middle" fill="currentColor" fontSize="9.5" fontWeight="600" letterSpacing="1">
        {translate("en", "seal.received")}
      </text>
    </svg>
  );
}
