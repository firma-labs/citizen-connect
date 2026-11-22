"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Token + QR shown full-width so the citizen can photograph it (PRD §4.1 #3). */
export function TokenCard({ token, pages }: { token: string; pages?: number }) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const u = `${window.location.origin}/track?t=${encodeURIComponent(token)}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- origin is only known in the browser
    setUrl(u);
    QRCode.toDataURL(u, { errorCorrectionLevel: "M", margin: 1, width: 640, color: { dark: "#0d3a1c", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [token]);

  return (
    <div className="rounded-3xl border-4 border-forest-700 bg-white p-5 text-center shadow-lg">
      <div className="text-base font-bold text-forest-800">आपला टोकन क्रमांक · Your token number</div>
      <div className="token-text my-3 whitespace-nowrap text-[clamp(1.4rem,8.4vw,3rem)] font-extrabold leading-tight text-ink">{token}</div>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL
        <img src={qr} alt={`QR code for ${token}`} className="mx-auto aspect-square w-full max-w-[18rem]" />
      ) : (
        <div className="mx-auto aspect-square w-full max-w-[18rem] animate-pulse rounded-xl bg-forest-50" />
      )}
      <p className="mt-3 text-[15px] leading-snug">
        कृपया या स्क्रीनचा फोटो घ्या. अर्जाची स्थिती पाहण्यासाठी हा क्रमांक व तुमचा मोबाईल क्रमांक वापरा.
      </p>
      <p className="mt-1 text-sm text-muted">
        Please take a photo of this screen. Use this number and your mobile number to check status.
      </p>
      {pages ? <p className="mt-2 text-sm text-muted">{pages} page(s) received</p> : null}
      {url && <p className="mt-2 break-all text-xs text-muted">{url}</p>}
    </div>
  );
}
