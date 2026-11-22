import { promises as fs } from "node:fs";
import path from "node:path";
import type { Application } from "@/lib/types";
import type { PageBlob, Store } from "./types";

// File-backed store for local development. One JSON file per application and
// one file per page image under .data/ (git-ignored). Mock letters only.

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.LOCAL_DATA_DIR ?? ".data");
const APPS = path.join(ROOT, "applications");
const PAGES = path.join(ROOT, "pages");

const safe = (token: string) => token.replace(/[^A-Z0-9-]/gi, "");
const appFile = (token: string) => path.join(APPS, `${safe(token)}.json`);
const pageFile = (token: string, idx: number) => path.join(PAGES, safe(token), `${idx}.bin`);

// Serialise read-modify-write per token within this process.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.catch(() => {}));
  return next;
}

async function readJson(file: string): Promise<Application | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Application;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

async function writeJson(file: string, app: Application) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(app, null, 2));
  await fs.rename(tmp, file);
}

export const localStore: Store = {
  name: "local",
  get: (token) => readJson(appFile(token)),
  createIfAbsent: (app) =>
    withLock(app.token, async () => {
      const existing = await readJson(appFile(app.token));
      if (existing) return existing;
      await writeJson(appFile(app.token), app);
      return app;
    }),
  update: (token, fn) =>
    withLock(token, async () => {
      const current = await readJson(appFile(token));
      if (!current) return null;
      const next = fn(structuredClone(current));
      if (!next) return current;
      next.updated_at = new Date().toISOString();
      await writeJson(appFile(token), next);
      return next;
    }),
  async list(limit = 200) {
    let files: string[] = [];
    try {
      files = (await fs.readdir(APPS)).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    const apps = (await Promise.all(files.map((f) => readJson(path.join(APPS, f))))).filter(
      (a): a is Application => !!a,
    );
    return apps.sort((a, b) => b.captured_at.localeCompare(a.captured_at)).slice(0, limit);
  },
  async putPage(token, idx, page) {
    const file = pageFile(token, idx);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, page.bytes);
    await fs.writeFile(`${file}.type`, page.contentType);
  },
  async getPage(token, idx): Promise<PageBlob | null> {
    const file = pageFile(token, idx);
    try {
      const [bytes, contentType] = await Promise.all([
        fs.readFile(file),
        fs.readFile(`${file}.type`, "utf8").catch(() => "image/jpeg"),
      ]);
      return { bytes: new Uint8Array(bytes), contentType };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  },
};
