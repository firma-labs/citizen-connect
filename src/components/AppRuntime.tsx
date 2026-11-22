"use client";

import { useEffect, useState } from "react";
import { startSync } from "@/lib/client/sync";
import { detectEnv, type BrowserEnv } from "@/lib/client/environment";
import { useHtmlLang, useI18n } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

/** Registers the service worker, starts background upload, keeps <html lang> current, warns about in-app browsers. */
export function AppRuntime() {
  useHtmlLang();
  const { t } = useI18n();
  const [env, setEnv] = useState<BrowserEnv | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const dev = process.env.NODE_ENV !== "production" ? "?dev=1" : "";
      navigator.serviceWorker.register(`/sw.js${dev}`, { scope: "/", updateViaCache: "none" }).catch((e) => {
        console.warn("service worker registration failed", e);
      });
    }
    startSync();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only detection after mount
    setEnv(detectEnv());
  }, []);

  if (!env || dismissed) return null;
  if (env.inAppBrowser) {
    return (
      <div className="border-b border-rule bg-surface p-3">
        <Notice tone="attention" title={t("env.inApp.title")}>
          <p>{t("env.inApp.body", { app: env.inAppBrowser })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {env.chromeIntentUrl && <Button href={env.chromeIntentUrl}>{t("env.openChrome")}</Button>}
            <Button variant="secondary" onClick={() => setDismissed(true)}>
              {t("env.continue")}
            </Button>
          </div>
        </Notice>
      </div>
    );
  }
  if (env.iosStandalone) {
    return (
      <div className="border-b border-rule bg-surface p-3">
        <Notice tone="attention">
          <p>{t("env.ios")}</p>
          <Button variant="secondary" className="mt-3" onClick={() => setDismissed(true)}>
            {t("env.ok")}
          </Button>
        </Notice>
      </div>
    );
  }
  return null;
}
