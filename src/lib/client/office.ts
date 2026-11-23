"use client";

// Office-wide view of applications: the server list (every phone) merged with
// what this phone has not uploaded yet. Home and Queue both count from here,
// so their numbers always agree.

import { useEffect, useState } from "react";
import { listApps, subscribe, type LocalApplication } from "./db";
import type { ArchiveRecord } from "@/lib/types";
import { onSyncState } from "./sync";

export interface ServerRow {
  token: string;
  status: string;
  captured_at: string;
  captured_by: string | null;
  page_count: number;
  read_error: string | null;
  summary_en: string | null;
  verified: { department: string } | null;
  archived?: ArchiveRecord | null;
}

// Last server list, kept for the session so screens show numbers straight away
// (and offline) instead of zeros while the request crosses the network.
const CACHE_KEY = "cc-queue-server";
let memoryCache: ServerRow[] | null = null;
function readCache(): ServerRow[] | null {
  if (memoryCache) return memoryCache;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ServerRow[]) : null;
  } catch {
    return null;
  }
}
function writeCache(rows: ServerRow[]) {
  memoryCache = rows;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {}
}

// One shared poller for the whole app: every screen and the bottom tab bar
// read the same server list instead of each fetching its own.
let serverRows: ServerRow[] | null = null;
const listeners = new Set<() => void>();
let stopPolling: (() => void) | null = null;
let lastLoad = 0;

function loadServer() {
  lastLoad = Date.now();
  fetch("/api/applications", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => {
      serverRows = d.applications;
      writeCache(d.applications);
    })
    // Offline or failed: keep showing the last list rather than nothing.
    .catch(() => {
      serverRows ??= readCache();
    })
    .finally(() => listeners.forEach((l) => l()));
}

function startPolling(pollMs: number) {
  const timer = setInterval(loadServer, pollMs);
  const off = onSyncState((s) => {
    if (!s.running) loadServer(); // an upload just finished
  });
  return () => {
    clearInterval(timer);
    off();
  };
}

/** This phone's applications (drafts excluded) and the server's list, kept fresh. */
export function useOfficeApplications(pollMs = 10_000) {
  const [local, setLocal] = useState<LocalApplication[]>([]);
  const [server, setServer] = useState<ServerRow[] | null>(null);

  useEffect(() => {
    const refresh = () => listApps().then((a) => setLocal(a.filter((x) => x.state !== "draft")));
    void refresh();
    const unsub = subscribe(() => void refresh());

    const update = () => setServer(serverRows);
    listeners.add(update);
    // Show what is known at once (after hydration, so server and client HTML match), then refresh.
    void Promise.resolve().then(() => setServer(serverRows ?? readCache()));
    if (listeners.size === 1) stopPolling = startPolling(pollMs);
    if (Date.now() - lastLoad > 2_000) loadServer(); // several screens mounting together share one request
    return () => {
      unsub();
      listeners.delete(update);
      if (listeners.size === 0) {
        stopPolling?.();
        stopPolling = null;
      }
    };
  }, [pollMs]);

  return { local, server, reload: loadServer };
}

/** Status of a local application, preferring the server's newer status once uploaded. */
export function localStatus(a: LocalApplication, byToken: Map<string, ServerRow>): string {
  return a.state === "queued" ? "queued" : (byToken.get(a.token)?.status ?? a.server_status ?? "captured");
}

/**
 * One entry per application across all phones: status and capture time.
 * Archived applications are left out of every list and count, and returned
 * separately so they can be restored (or deleted, in the pilot).
 */
export function officeSummary(allLocal: LocalApplication[], server: ServerRow[] | null) {
  const byToken = new Map((server ?? []).map((s) => [s.token, s]));
  const archived = (server ?? []).filter((s) => s.archived).sort((a, b) => b.archived!.at.localeCompare(a.archived!.at));
  const archivedTokens = new Set(archived.map((s) => s.token));
  // The server's answer wins (it knows about restores); the phone's own flag only counts offline.
  const local = allLocal.filter((a) => (byToken.has(a.token) ? !archivedTokens.has(a.token) : !a.archived));
  const localTokens = new Set(allLocal.map((l) => l.token));
  const others = (server ?? []).filter((s) => !localTokens.has(s.token) && !s.archived);
  const all = [
    ...local.map((a) => ({ status: localStatus(a, byToken), captured_at: a.captured_at })),
    ...others.map((s) => ({ status: s.status, captured_at: s.captured_at })),
  ];
  const count = (...st: string[]) => all.filter((x) => st.includes(x.status)).length;
  return {
    byToken,
    /** This phone's applications that are not archived. */
    local,
    others,
    archived,
    toCheck: count("read", "read_failed"),
    reading: count("queued", "captured", "reading"),
    routed: count("routed", "in_progress", "closed"),
    /** Captured today on this device's calendar, by any phone. */
    today: all.filter((x) => new Date(x.captured_at).toDateString() === new Date().toDateString()).length,
    /** Scanned on this phone and not uploaded yet — only this phone can send these. */
    notUploaded: local.filter((a) => a.state === "queued").length,
  };
}
