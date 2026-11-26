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
