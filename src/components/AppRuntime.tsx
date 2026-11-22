"use client";

import { useEffect, useState } from "react";
import { startSync } from "@/lib/client/sync";
import { detectEnv, type BrowserEnv } from "@/lib/client/environment";

/** Registers the service worker, starts background sync, and warns about in-app browsers. */
export function AppRuntime() {
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
      <div className="bg-warn-50 border-b-2 border-warn-500 px-4 py-3 text-[15px]">
        <p className="font-bold">Chrome मध्ये उघडा · Open in Chrome</p>
        <p className="mt-1">
          You are inside {env.inAppBrowser}. The camera and offline queue work reliably only in Chrome.
        </p>
        <div className="mt-2 flex gap-2">
          {env.chromeIntentUrl && (
            <a href={env.chromeIntentUrl} className="rounded-lg bg-forest-700 px-4 py-2 font-semibold text-white">
              Open in Chrome
            </a>
          )}
          <button onClick={() => setDismissed(true)} className="rounded-lg border border-line px-4 py-2">
            Continue anyway
          </button>
        </div>
      </div>
    );
  }
  if (env.iosStandalone) {
    return (
      <div className="bg-warn-50 border-b-2 border-warn-500 px-4 py-3 text-[15px]">
        <p>
          On iPhone, use this app in <b>Safari</b>, not from the home-screen icon — the camera can stop when you switch
          screens.
        </p>
        <button onClick={() => setDismissed(true)} className="mt-2 rounded-lg border border-line px-4 py-2">
          OK
        </button>
      </div>
    );
  }
  return null;
}
