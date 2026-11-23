"use client";

// Office-wide view of applications: the server list (every phone) merged with
// what this phone has not uploaded yet. Home and Queue both count from here,
// so their numbers always agree.

import { useCallback, useEffect, useState } from "react";
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

/** This phone's applications (drafts excluded) and the server's list, kept fresh. */
export function useOfficeApplications(pollMs = 10_000) {
  const [local, setLocal] = useState<LocalApplication[]>([]);
  const [server, setServer] = useState<ServerRow[] | null>(null);

  const loadServer = useCallback(() => {
    fetch("/api/applications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        writeCache(d.applications);
        setServer(d.applications);
      })
      // Offline or failed: keep showing the last list rather than nothing.
      .catch(() => setServer((cur) => cur ?? readCache()));
  }, []);

  useEffect(() => {
    const refresh = () => listApps().then((a) => setLocal(a.filter((x) => x.state !== "draft")));
    void refresh();
    // Show the cached list at once (after hydration, so server and client HTML match), then refresh.
    void Promise.resolve().then(() => setServer((cur) => cur ?? readCache()));
    loadServer();
    const unsub = subscribe(() => void refresh());
    const off = onSyncState((s) => {
      if (!s.running) loadServer(); // an upload just finished
    });
    const timer = setInterval(loadServer, pollMs);
    return () => {
      unsub();
      off();
      clearInterval(timer);
    };
  }, [loadServer, pollMs]);

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
