import { BlobError, BlobPreconditionFailedError, del, get, head, list, put } from "@vercel/blob";
import type { Application } from "@/lib/types";
import { StoreBusyError, type AiReadResult, type PageBlob, type Store } from "./types";

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
/**
 * Random wait before retrying a write that lost a race. Short at first (another
 * save landed at the same moment), then longer, so a read that lags just behind
 * a write has time to catch up: about 4 s in all before giving up.
 */
const backoff = (attempt: number) =>
  new Promise((r) => setTimeout(r, attempt < 5 ? Math.random() * 40 * (attempt + 1) : 250 + Math.random() * 250));


/**
 * A compressed response can carry a weak ETag (W/"…"), which never satisfies a
 * conditional write. The version it names is the same, so drop the W/ marker.
 */
const strongEtag = (etag: string) => etag.replace(/^W\//, "");

interface ReadResult {
  bytes: Uint8Array;
  contentType: string;
  etag: string;
  /** From Last-Modified (whole seconds), or null when the response had none. */
  uploadedAt: number | null;
}

async function read(path: string): Promise<ReadResult | null> {
  try {
    const r = await get(path, { access: ACCESS, useCache: false });
    if (!r || r.statusCode !== 200 || !r.stream) return null;
    const bytes = new Uint8Array(await new Response(r.stream).arrayBuffer());
    return {
      bytes,
      contentType: r.blob.contentType ?? "application/octet-stream",
      etag: strongEtag(r.blob.etag),
      uploadedAt: r.headers.get("last-modified") ? r.blob.uploadedAt.getTime() : null,
    };
  } catch (e) {
    if (e instanceof BlobError && /not ?found/i.test(e.message)) return null;
    throw e;
  }
}

interface Versioned<T> {
  data: T;
  etag: string;
  size: number;
  uploadedAt: number | null;
}

async function readJson<T>(path: string): Promise<Versioned<T> | null> {
  const r = await read(path);
  return r
    ? { data: JSON.parse(new TextDecoder().decode(r.bytes)) as T, etag: r.etag, size: r.bytes.byteLength, uploadedAt: r.uploadedAt }
    : null;
}

/**
 * Write `data` only if the file is still the version `cur` was read from.
 * If the store refuses the ETag from the read, ask the store's metadata (head)
 * for the file's current ETag: when size and upload time show it is the same
 * version the read returned, retry once with that ETag. If it is a newer
 * version, someone else saved in between, and the caller re-reads.
 * Returns false when the caller should re-read and try again.
 */
let explained = false;
async function writeIfUnchanged(path: string, cur: Versioned<unknown>, data: unknown): Promise<boolean> {
  try {
    await writeJson(path, data, { ifMatch: cur.etag });
    return true;
  } catch (e) {
    if (!conflict(e)) throw e;
  }
  const meta = await head(path).catch(() => null);
  if (!meta) return false;
  const metaEtag = strongEtag(meta.etag);
  const sameVersion =
    meta.size === cur.size && cur.uploadedAt !== null && Math.floor(meta.uploadedAt.getTime() / 1000) === Math.floor(cur.uploadedAt / 1000);
  if (!explained) {
    explained = true; // once per instance: what the read and the metadata said
    console.warn(
      `blob conditional write refused for ${path}: read etag ${cur.etag} size ${cur.size} at ${cur.uploadedAt}; ` +
        `head etag ${meta.etag} size ${meta.size} at ${meta.uploadedAt.getTime()}; same version: ${sameVersion}`,
    );
  }
  if (!sameVersion || metaEtag === cur.etag) return false;
  try {
    await writeJson(path, data, { ifMatch: metaEtag });
    return true;
  } catch (e) {
    if (!conflict(e)) throw e;
    return false;
  }
}

// What this instance last wrote to each JSON file, with the ETag the store gave
// it. On Vercel a read made right after an overwrite can still return the
// previous version, whose ETag then fails every conditional write. Verifying
// saves twice in a row (the record, then the SMS log), so it hit exactly that.
// Updates first try from this copy: if nobody else has written since, its ETag
// matches and the write goes through; if someone has, the write is refused
// (ifMatch) and the next attempt reads the store instead.
const written = new Map<string, { etag: string; data: unknown; size: number; uploadedAt: number }>();

/** The newest version to update from: the store's, or this instance's own later write. */
async function readForUpdate<T>(path: string, attempt: number): Promise<Versioned<T> | null> {
  const cur = await readJson<T>(path);
  const mine = written.get(path);
  // Only when the file still exists: never bring back one that was deleted meanwhile.
  if (cur && mine && cur.etag !== mine.etag && attempt % 2 === 0) return { data: structuredClone(mine.data) as T, etag: mine.etag, size: mine.size, uploadedAt: mine.uploadedAt };
  return cur;
}

/** Write JSON. `create` fails if the file exists; `ifMatch` fails if it changed since read. */
async function writeJson(path: string, data: unknown, opts: { create?: boolean; ifMatch?: string }) {
  const body = JSON.stringify(data);
  const r = await put(path, body, {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: !opts.create,
    ifMatch: opts.ifMatch,
    cacheControlMaxAge: 60,
  });
  written.set(path, {
    etag: strongEtag(r.etag),
    data: structuredClone(data),
    size: new TextEncoder().encode(body).byteLength,
    uploadedAt: Date.now(),
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
    found.push(...page.blobs.map((b) => ({ pathname: b.pathname, etag: strongEtag(b.etag) })));
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
      const cur = await readForUpdate<Application>(appPath(token), attempt);
      if (!cur) return null;
      const next = fn(structuredClone(cur.data));
      if (!next) return cur.data;
      next.updated_at = new Date().toISOString();
      if (await writeIfUnchanged(appPath(token), cur, next)) return next;
      await backoff(attempt); // someone else saved first — re-read and re-apply
    }
    throw new StoreBusyError(`update conflict on ${token}`);
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
    written.delete(appPath(token));
    invalidate();
  },

  async wasRemoved(token) {
    return (await read(deletedPath(token))) !== null;
  },

  async takeAiRead(day, user, userLimit, totalLimit): Promise<AiReadResult> {
    for (let attempt = 0; attempt < RETRIES * 2; attempt++) {
      const cur = await readForUpdate<Record<string, number>>(usagePath(day), attempt);
      const counts = cur?.data ?? {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (totalLimit > 0 && total >= totalLimit) return { ok: false, reason: "total" };
      const used = counts[user] ?? 0;
      if (used >= userLimit) return { ok: false, reason: "user" };
      const next = { ...counts, [user]: used + 1 };
      if (cur) {
        if (await writeIfUnchanged(usagePath(day), cur, next)) return { ok: true, used: used + 1 };
      } else {
        try {
          await writeJson(usagePath(day), next, { create: true });
          return { ok: true, used: used + 1 };
        } catch (e) {
          if (!conflict(e)) throw e;
        }
      }
      await backoff(attempt); // another reading took a slot at the same moment
    }
    throw new StoreBusyError("AI usage counter is busy — try again");
  },

  async aiReadsOn(day, user) {
    const counts = (await readJson<Record<string, number>>(usagePath(day)))?.data ?? {};
    return { user: counts[user] ?? 0, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  },
};
