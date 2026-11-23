"use client";

import type { PageEdits } from "./image";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Everything captured lives in IndexedDB first, so nothing is lost if the
// network drops, the app is backgrounded, the screen locks or the tab is
// closed (PRD §6, §10). The sync engine drains it to the server.

export type LocalState = "draft" | "queued" | "synced";

export interface LocalApplication {
  /** Server says staff archived it (stop polling; counts come from the server list). */
  archived?: boolean;
  token: string;
  venue: string;
  captured_at: string;
  captured_by: string | null;
  state: LocalState;
  page_count: number;
  pages_uploaded: number[];
  created_on_server: boolean;
  read_requested: boolean;
  server_status?: string;
  last_error?: string | null;
  last_sync_at?: string;
}

export interface LocalPage {
  key: string; // `${token}:${idx}`
  token: string;
  idx: number;
  blob: Blob;
  width: number;
  height: number;
  /** Straightened to the page edges. */
  cropped: boolean;
  /** The photo as taken, so staff can re-adjust the page before upload. */
  original?: { blob: Blob; width: number; height: number };
  /** Corners, rotation and scan/photo choice used to make `blob` from `original`. */
  edits?: PageEdits;
}

interface CCSchema extends DBSchema {
  applications: { key: string; value: LocalApplication; indexes: { by_state: LocalState } };
  pages: { key: string; value: LocalPage; indexes: { by_token: string } };
  settings: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<CCSchema>> | null = null;
export function db() {
  if (!dbp) {
    dbp = openDB<CCSchema>("citizen-connect", 1, {
      upgrade(d) {
        const apps = d.createObjectStore("applications", { keyPath: "token" });
        apps.createIndex("by_state", "state");
        const pages = d.createObjectStore("pages", { keyPath: "key" });
        pages.createIndex("by_token", "token");
        d.createObjectStore("settings");
      },
    });
  }
  return dbp;
}

export const pageKey = (token: string, idx: number) => `${token}:${idx}`;

export async function getApp(token: string) {
  return (await db()).get("applications", token);
}

export async function putApp(app: LocalApplication) {
  await (await db()).put("applications", app);
  notify();
}

export async function patchApp(token: string, patch: Partial<LocalApplication>) {
  const d = await db();
  const tx = d.transaction("applications", "readwrite");
  const cur = await tx.store.get(token);
  if (cur) await tx.store.put({ ...cur, ...patch });
  await tx.done;
  notify();
}

export async function listApps(): Promise<LocalApplication[]> {
  const all = await (await db()).getAll("applications");
  return all.sort((a, b) => b.captured_at.localeCompare(a.captured_at));
}

export async function getDraft(): Promise<LocalApplication | undefined> {
  return (await (await db()).getAllFromIndex("applications", "by_state", "draft"))[0];
}

export async function getPages(token: string): Promise<LocalPage[]> {
  const pages = await (await db()).getAllFromIndex("pages", "by_token", token);
  return pages.sort((a, b) => a.idx - b.idx);
}

export async function getPage(token: string, idx: number) {
  return (await db()).get("pages", pageKey(token, idx));
}

/** A copy of a blob held in memory, independent of where it was read from. */
async function ownCopy(blob: Blob): Promise<Blob> {
  try {
    return new Blob([await blob.arrayBuffer()], { type: blob.type });
  } catch {
    return blob; // already unreadable (lost before this fix): keep it so staff can delete or retake that page
  }
}

/** Replace the full page list for a draft (used after add/remove/reorder). */
export async function setPages(token: string, pages: Omit<LocalPage, "key" | "idx" | "token">[]) {
  // Safari/iOS: a blob read from IndexedDB is a reference to the stored record,
  // not a copy. Deleting the old records below would leave those references
  // empty (the first page showed as a broken image after adding a second).
  // Copy every image into memory first — outside the transaction, since
  // awaiting anything but IndexedDB inside it would end the transaction.
  pages = await Promise.all(
    pages.map(async (p) => ({
      ...p,
      blob: await ownCopy(p.blob),
      original: p.original ? { ...p.original, blob: await ownCopy(p.original.blob) } : undefined,
    })),
  );
  const d = await db();
  const tx = d.transaction(["pages", "applications"], "readwrite");
  const existing = await tx.objectStore("pages").index("by_token").getAllKeys(token);
  for (const k of existing) await tx.objectStore("pages").delete(k);
  for (let i = 0; i < pages.length; i++) {
    await tx.objectStore("pages").put({ ...pages[i], token, idx: i, key: pageKey(token, i) });
  }
  const app = await tx.objectStore("applications").get(token);
  if (app) await tx.objectStore("applications").put({ ...app, page_count: pages.length });
  await tx.done;
  notify();
}

export async function deleteApp(token: string) {
  const d = await db();
  const tx = d.transaction(["pages", "applications"], "readwrite");
  const keys = await tx.objectStore("pages").index("by_token").getAllKeys(token);
  for (const k of keys) await tx.objectStore("pages").delete(k);
  await tx.objectStore("applications").delete(token);
  await tx.done;
  notify();
}

/** Free local image storage once the server has every page and the record is verified. */
export async function prunePages(token: string) {
  const d = await db();
  const tx = d.transaction("pages", "readwrite");
  const keys = await tx.store.index("by_token").getAllKeys(token);
  for (const k of keys) await tx.store.delete(k);
  await tx.done;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await (await db()).get("settings", key);
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  await (await db()).put("settings", value, key);
  notify();
}

// Tiny change-notification bus so lists re-render after writes (also across tabs).
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
function notify() {
  listeners.forEach((l) => l());
  channel?.postMessage("changed");
}
export function subscribe(fn: () => void) {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("cc-db");
    channel.onmessage = () => listeners.forEach((l) => l());
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
