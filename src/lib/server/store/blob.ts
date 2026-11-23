import { BlobError, BlobPreconditionFailedError, del, get, list, put } from "@vercel/blob";
import type { Application } from "@/lib/types";
import type { AiReadResult, PageBlob, Store } from "./types";

// Vercel Blob store for the hosted pilot (Vercel Preview). Same layout as the
// local .data/ folder, in one private Blob store:
//
//   applications/<token>.json   one JSON document per application
//   pages/<token>/<n>           page images
//   ai-usage/<YYYY-MM-DD>.json  { "<mobile>": readings } for the daily AI caps
//   deleted/<token>.json        marker left by a permanent delete (blocks re-upload)
//
// Reads bypass the CDN cache (useCache: false) so polling always sees the
// latest status. Updates are conditional on the ETag read (ifMatch), so two
// writers can't overwrite each other — the loser re-reads and retries.
// Credentials come from the store's connection to the Vercel project
// (OIDC / BLOB_STORE_ID, or BLOB_READ_WRITE_TOKEN).

const ACCESS = "private" as const;
const safe = (token: string) => token.replace(/[^A-Z0-9-]/gi, "");
const appPath = (token: string) => `applications/${safe(token)}.json`;
const pagePath = (token: string, idx: number) => `pages/${safe(token)}/${idx}`;
const usagePath = (day: string) => `ai-usage/${day}.json`;
const deletedPath = (token: string) => `deleted/${safe(token)}.json`;
const RETRIES = 15;
/** Short random wait before retrying a write someone else beat us to (spreads out retries). */
const backoff = (attempt: number) => new Promise((r) => setTimeout(r, Math.random() * 40 * Math.min(attempt + 1, 5)));

async function read(path: string): Promise<{ bytes: Uint8Array; contentType: string; etag: string } | null> {
  try {
    const r = await get(path, { access: ACCESS, useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    const bytes = new Uint8Array(await new Response(r.stream).arrayBuffer());
    return { bytes, contentType: r.blob.contentType ?? "application/octet-stream", etag: r.blob.etag };
  } catch (e) {
    if (e instanceof BlobError && /not ?found/i.test(e.message)) return null;
    throw e;
  }
}

async function readJson<T>(path: string): Promise<{ data: T; etag: string } | null> {
  const r = await read(path);
  return r ? { data: JSON.parse(new TextDecoder().decode(r.bytes)) as T, etag: r.etag } : null;
}

/** Write JSON. `create` fails if the file exists; `ifMatch` fails if it changed since read. */
async function writeJson(path: string, data: unknown, opts: { create?: boolean; ifMatch?: string }) {
  await put(path, JSON.stringify(data), {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: !opts.create,
    ifMatch: opts.ifMatch,
    cacheControlMaxAge: 60,
  });
  invalidate();
}

const alreadyExists = (e: unknown) => e instanceof BlobError && /already exists/i.test(e.message);
const conflict = (e: unknown) => e instanceof BlobPreconditionFailedError || alreadyExists(e);

/** Run `fn` over items with at most `n` in flight. */
async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

// Every open Home / Queue / Applications screen polls the list (about every
// 10 s). Two things keep that cheap on Blob:
//   - Documents are kept in memory by ETag: one `list` call says which changed,
//     and only those are downloaded again.
//   - Polls arriving together (several phones, several screens) share one
//     listing for a couple of seconds instead of each starting its own.
// Memory is per function instance; a cold instance simply reads everything once.
const docs = new Map<string, { etag: string; app: Application }>();
const SHARE_MS = 2_000;
let shared: { at: number; result: Promise<Application[]> } | null = null;

function listAll(): Promise<Application[]> {
  if (shared && Date.now() - shared.at < SHARE_MS) return shared.result;
  const result = listFresh();
  shared = { at: Date.now(), result };
  result.catch(() => {
    if (shared?.result === result) shared = null; // don't hand a failure to the next caller
  });
  return result;
}

async function listFresh(): Promise<Application[]> {
  const found: { pathname: string; etag: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "applications/", limit: 1000, cursor });
    found.push(...page.blobs.map((b) => ({ pathname: b.pathname, etag: b.etag })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  const present = new Set(found.map((b) => b.pathname));
  for (const path of docs.keys()) if (!present.has(path)) docs.delete(path);

  const apps = await mapLimit(found, 8, async ({ pathname, etag }) => {
    const known = docs.get(pathname);
    if (known && known.etag === etag) return known.app;
    const r = await readJson<Application>(pathname);
    if (!r) return null;
    docs.set(pathname, { etag: r.etag, app: r.data });
    return r.data;
  });
  return apps.filter((a): a is Application => a !== null);
}

/** Forget the shared listing after a write here, so the writer's next list shows its change at once. */
function invalidate() {
  shared = null;
}

export const blobStore: Store = {
  name: "vercel blob",

  async get(token) {
    return (await readJson<Application>(appPath(token)))?.data ?? null;
  },

  async createIfAbsent(app) {
    const existing = await readJson<Application>(appPath(app.token));
    if (existing) return existing.data;
    try {
      await writeJson(appPath(app.token), app, { create: true });
      return app;
    } catch (e) {
      if (alreadyExists(e)) return (await this.get(app.token))!;
      throw e;
    }
  },

  async update(token, fn) {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const cur = await readJson<Application>(appPath(token));
      if (!cur) return null;
      const next = fn(structuredClone(cur.data));
      if (!next) return cur.data;
      next.updated_at = new Date().toISOString();
      try {
        await writeJson(appPath(token), next, { ifMatch: cur.etag });
        return next;
      } catch (e) {
        if (conflict(e)) {
          await backoff(attempt); // someone else saved first — re-read and re-apply
          continue;
        }
        throw e;
      }
    }
    throw new Error(`update conflict on ${token}`);
  },

  /** Newest first. */
  async list(limit = 200) {
    const apps = await listAll();
    return [...apps].sort((a, b) => b.captured_at.localeCompare(a.captured_at)).slice(0, limit);
  },

  async putPage(token, idx, page) {
    await put(pagePath(token, idx), Buffer.from(page.bytes), {
      access: ACCESS,
      contentType: page.contentType,
      addRandomSuffix: false,
      allowOverwrite: true, // rescans replace pages
      cacheControlMaxAge: 60,
    });
  },

  async getPage(token, idx): Promise<PageBlob | null> {
    const r = await read(pagePath(token, idx));
    return r ? { bytes: r.bytes, contentType: r.contentType } : null;
  },

  async remove(token, by) {
    await writeJson(deletedPath(token), { token, at: new Date().toISOString(), by }, {});
    const pages: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `pages/${safe(token)}/`, limit: 1000, cursor });
      pages.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    await del([appPath(token), ...pages]);
    invalidate();
  },

  async wasRemoved(token) {
    return (await read(deletedPath(token))) !== null;
  },

  async takeAiRead(day, user, userLimit, totalLimit): Promise<AiReadResult> {
    for (let attempt = 0; attempt < RETRIES * 2; attempt++) {
      const cur = await readJson<Record<string, number>>(usagePath(day));
      const counts = cur?.data ?? {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (totalLimit > 0 && total >= totalLimit) return { ok: false, reason: "total" };
      const used = counts[user] ?? 0;
      if (used >= userLimit) return { ok: false, reason: "user" };
      try {
        await writeJson(usagePath(day), { ...counts, [user]: used + 1 }, cur ? { ifMatch: cur.etag } : { create: true });
        return { ok: true, used: used + 1 };
      } catch (e) {
        if (conflict(e)) {
          await backoff(attempt); // another reading took a slot at the same moment
          continue;
        }
        throw e;
      }
    }
    throw new Error("AI usage counter is busy — try again");
  },

  async aiReadsOn(day, user) {
    const counts = (await readJson<Record<string, number>>(usagePath(day)))?.data ?? {};
    return { user: counts[user] ?? 0, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  },
};
