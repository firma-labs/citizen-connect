"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { startSync } from "@/lib/client/sync";
import { detectEnv, type BrowserEnv } from "@/lib/client/environment";
import { useSettings } from "@/lib/client/settings";
import { useHtmlLang, useI18n } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";
import { isPublicPath, noteScreen } from "@/lib/client/nav";

/**
 * Sends a screen that is already open to sign-in once the server says this
 * device isn't signed in — e.g. sign-in was switched on, or the session
 * expired, while the app sat open on a phone. New page loads are already
 * redirected by the proxy; this covers screens that are open or restored from
 * the offline cache. Checks on load, on every screen change, when the app
 * comes back to the front, and when the connection returns. Offline it does
 * nothing, so scanning without signal keeps working.
 */
function useSessionGuard() {
  const pathname = usePathname();
  useEffect(() => {
    if (isPublicPath(pathname)) return;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const me: { mode: string; signedIn: boolean } = await res.json();
        if (me.mode !== "open" && !me.signedIn && !stopped) {
          // Same as the proxy: Home signed out shows the public landing page.
          if (window.location.pathname === "/") return window.location.replace("/welcome");
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.replace(`/login?next=${next}`);
        }
      } catch {
        // offline or server unreachable — keep working; check again later
      }
    };
    void check();
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    const timer = setInterval(check, 5 * 60_000);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      clearInterval(timer);
    };
  }, [pathname]);
}

/** Registers the service worker, starts background upload, keeps <html lang> current, enforces sign-in, warns about in-app browsers. */
/** Applies the in-app Text size (Settings → App) on top of the phone's own text size. */
function useTextScale() {
  const [settings] = useSettings();
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(settings.textScale || 1));
  }, [settings.textScale]);
}

/** Records the screens this tab shows, for the app bar's back arrow (lib/client/nav). */
function useScreenTrail() {
  const pathname = usePathname();
  useEffect(() => noteScreen(pathname), [pathname]);
}

export function AppRuntime() {
  useScreenTrail();
  useHtmlLang();
  useTextScale();
  useSessionGuard();
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
  return null;
}
