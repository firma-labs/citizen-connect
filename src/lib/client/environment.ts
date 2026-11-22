"use client";

// PRD §6: open the link in Chrome, not WhatsApp's/Gmail's in-app browser; on
// iPhone use Safari directly rather than an installed home-screen app.

export interface BrowserEnv {
  inAppBrowser: string | null;
  isAndroid: boolean;
  isIOS: boolean;
  iosStandalone: boolean;
  chromeIntentUrl: string | null;
}

export function detectEnv(): BrowserEnv {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let inAppBrowser: string | null = null;
  if (/WhatsApp/i.test(ua)) inAppBrowser = "WhatsApp";
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) inAppBrowser = "Facebook";
  else if (/Instagram/i.test(ua)) inAppBrowser = "Instagram";
  else if (/\bGSA\//i.test(ua)) inAppBrowser = "Google app";
  else if (/Line\//i.test(ua)) inAppBrowser = "LINE";
  else if (isAndroid && /; wv\)/.test(ua)) inAppBrowser = "an in-app browser";
  const iosStandalone = isIOS && (("standalone" in navigator && (navigator as { standalone?: boolean }).standalone) || matchMedia("(display-mode: standalone)").matches);
  const { host, pathname, search } = window.location;
  const chromeIntentUrl = isAndroid ? `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end` : null;
  return { inAppBrowser, isAndroid, isIOS, iosStandalone: !!iosStandalone, chromeIntentUrl };
}
