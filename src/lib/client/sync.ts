"use client";

import { deleteApp, getPage, listApps, patchApp, prunePages, type LocalApplication } from "./db";

// Drains queued captures to the server: create record → upload each missing
// page → ask for the AI read → poll status. Every step is idempotent on the
// server, so a retry after a dropped connection or a killed tab is safe.

const POLL_MS = 15_000;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

export type SyncListener = (s: { running: boolean; online: boolean; lastError: string | null }) => void;
const listeners = new Set<SyncListener>();
let lastError: string | null = null;
const emit = () =>
  listeners.forEach((l) => l({ running, online: typeof navigator === "undefined" || navigator.onLine, lastError }));

export function onSyncState(fn: SyncListener) {
  listeners.add(fn);
  emit();
  return () => {
    listeners.delete(fn);
  };
}

export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    emit();
    void syncNow();
  });
  window.addEventListener("offline", emit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  timer = setInterval(() => void syncNow(), POLL_MS);
  void syncNow();
  // Ask the browser not to evict our queue under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
}

export function stopSync() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

const DONE = new Set(["routed", "in_progress", "closed"]);

export async function syncNow(): Promise<void> {
  if (running || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  running = true;
  lastError = null;
  emit();
  try {
    const apps = await listApps();
    for (const app of apps) {
      if (app.state === "draft") continue;
      if (app.state === "synced" && ((app.server_status && DONE.has(app.server_status)) || app.archived)) continue;
      try {
        await syncOne(app);
      } catch (e) {
        if ((e as HttpError).status === 410) {
          // Staff deleted it permanently (pilot clean-up): drop this phone's copy instead of uploading it again.
          await deleteApp(app.token);
          continue;
        }
        lastError = (e as Error).message;
        await patchApp(app.token, { last_error: lastError });
        if (!navigator.onLine) break;
      }
    }
  } finally {
    running = false;
    emit();
  }
}

type HttpError = Error & { status?: number };

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    // Signed out or session expired. Queued scans stay in IndexedDB and upload after sign-in.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- outside React; a full load restarts sync signed in
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? `${res.status} ${res.statusText}`), { status: res.status }) as HttpError;
  return body;
}

async function syncOne(app: LocalApplication) {
  const base = `/api/applications/${encodeURIComponent(app.token)}`;

  if (!app.created_on_server) {
    await call("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: app.token,
        venue: app.venue,
        captured_at: app.captured_at,
        captured_by: app.captured_by,
        page_count: app.page_count,
      }),
    });
    app = { ...app, created_on_server: true };
    await patchApp(app.token, { created_on_server: true });
  }

  for (let i = 0; i < app.page_count; i++) {
    if (app.pages_uploaded.includes(i)) continue;
    const page = await getPage(app.token, i);
    if (!page) throw new Error(`page ${i + 1} missing on this device`);
    const r = await call(`${base}/pages/${i}`, {
      method: "PUT",
      headers: { "Content-Type": page.blob.type || "image/jpeg" },
      body: page.blob,
    });
    app = { ...app, pages_uploaded: r.pages_received ?? [...app.pages_uploaded, i] };
    await patchApp(app.token, { pages_uploaded: app.pages_uploaded });
  }

  if (!app.read_requested) {
    await call(`${base}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    app = { ...app, read_requested: true };
    await patchApp(app.token, { read_requested: true });
  }

  const { application } = await call(base);
  const status: string = application.status;
  // A read interrupted by a server restart shows as stale "reading"; re-request it.
  if (status === "captured") await patchApp(app.token, { read_requested: false });
  await patchApp(app.token, {
    state: "synced",
    server_status: status,
    last_error: status === "read_failed" ? application.read_error : null,
    last_sync_at: new Date().toISOString(),
    archived: !!application.archived,
  });
  // Uploaded and either finished or archived: the server has the pages, free the phone's storage.
  if (DONE.has(status) || application.archived) await prunePages(app.token);
}

/** Fetch the server copy of one application (verification screen). */
export async function fetchApplication(token: string) {
  const { application } = await call(`/api/applications/${encodeURIComponent(token)}`);
  await patchApp(token, { server_status: application.status }).catch(() => {});
  return application;
}

export async function requestRead(token: string, force = false) {
  return call(`/api/applications/${encodeURIComponent(token)}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
}
