import { useEffect } from "react";

// Whether the browser's Back would stay inside the app. AppRuntime records each
// screen this tab shows; returning to the screen before the current one is
// taken as a Back (the trail shrinks), anything else as a new step. A screen
// opened directly - a link, a fresh app launch, a reload - has nothing in the
// app behind it, so its back arrow goes to its parent screen instead.

const trail: string[] = [];

export function noteScreen(path: string) {
  if (trail[trail.length - 1] === path) return; // same screen, e.g. only the query changed
  if (trail[trail.length - 2] === path) trail.pop();
  else trail.push(path);
}

export const canGoBackInApp = () => trail.length > 1;

/**
 * While `active`, ask before leaving the screen: any in-app link (back arrow,
 * tab bar, top-bar links) asks `message` first, and reloading or closing the
 * tab shows the browser's own "leave site?" prompt. Links are caught in the
 * capture phase, before Next's own click handling. The browser's back
 * gesture/button can't be held back in a single-page app; it is not covered.
 */
export function useLeaveGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // leaving the site: the browser's prompt covers it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // older Safari needs this to show the prompt
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active, message]);
}
