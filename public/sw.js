/* Citizen Connect service worker.
 * - App shell (intake pages + their JS/CSS) cached so capture works with no signal.
 * - /_next/static: cache-first in production (content-hashed). In dev, network-first
 *   for everything so code changes show up immediately.
 * - /api/*: never cached — capture data lives in IndexedDB and is synced by the app.
 */
const DEV = new URL(self.location.href).searchParams.get("dev") === "1";
const VERSION = "cc-v2";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const SHELL_ROUTES = ["/", "/capture", "/queue", "/verify", "/track", "/settings", "/offline", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) =>
        Promise.allSettled(
          SHELL_ROUTES.map(async (r) => {
            const res = await fetch(new Request(r, { cache: "reload" }));
            if (res.ok && !res.redirected) await c.put(r, res);
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    // Never store a redirect (e.g. to /login when signed out) under the page's own URL.
    if (res.ok && res.type === "basic" && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: request.mode === "navigate" })) ||
      (fallbackUrl && (await cache.match(fallbackUrl)));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.includes("__nextjs")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL, "/offline"));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") && !DEV) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  // RSC payloads, dev chunks, icons, fonts, manifest
  event.respondWith(networkFirst(request, STATIC));
});
