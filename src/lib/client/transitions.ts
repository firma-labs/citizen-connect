// Screen transitions: which animation a navigation gets, from where it goes.
//
//   nav-tab      between the four main screens (Home, Queue, Applications,
//                Dashboard): Material 3 "fade through", since they are peers
//   nav-forward  deeper (Queue → Check details, Home → Scan, → Settings):
//                Material 3 "shared axis", new screen slides in from the right
//   nav-back     back up (back arrow, tab bar from a detail screen): mirrored
//   nav-fade     anything else (same screen, browser back, redirects)
//
// The CSS for each lives in globals.css; <Screen> applies them.

export type NavType = "nav-tab" | "nav-forward" | "nav-back" | "nav-fade";

/** How deep each screen sits. Unlisted paths count as detail screens (1). */
const LEVEL: Record<string, number> = {
  "/": 0,
  "/queue": 0,
  "/applications": 0,
  "/dashboard": 0,
  "/privacy": 2,
  "/terms": 2,
  "/accessibility": 2,
};
const TABS = new Set(["/", "/queue", "/applications", "/dashboard"]);

const pathOf = (href: string) => href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
const levelOf = (path: string) => LEVEL[path] ?? 1;

export function navType(fromHref: string, toHref: string): NavType {
  const from = pathOf(fromHref);
  const to = pathOf(toHref);
  if (from === to) return "nav-fade";
  if (TABS.has(from) && TABS.has(to)) return "nav-tab";
  const a = levelOf(from);
  const b = levelOf(to);
  return b > a ? "nav-forward" : b < a ? "nav-back" : "nav-fade";
}

/** Enter/exit animation per navigation type, for <ViewTransition>. */
export const SCREEN_TRANSITION = {
  "nav-tab": "nav-tab",
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  "nav-fade": "nav-fade",
  // Untyped: browser back/forward, router.replace, a screen appearing after loading.
  default: "nav-fade",
};
