"use client";

import { useEffect, useRef, useState } from "react";
import { processPhoto, type ProcessedPage } from "@/lib/client/image";
import { useSettings } from "@/lib/client/settings";

interface Page extends ProcessedPage {
  url: string;
  changed: boolean;
}

/**
 * Replace the page photos of an application before it is verified — retake a
 * blurred/cropped page, add a missed one, remove a wrong one. Same token; the
 * pages are re-uploaded and the AI reads them again.
 */
export function RescanPanel({
  token,
  pageUrls,
  onCancel,
  onDone,
}: {
  token: string;
  pageUrls: string[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [settings] = useSettings();
  const [pages, setPages] = useState<Page[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const target = useRef<number | null>(null); // index to replace, or null = add at end
  const urls = useRef<string[]>([]); // every object URL created, revoked on unmount
  const [initialUrls] = useState(pageUrls); // snapshot: the parent re-renders while polling
  const objectUrl = (b: Blob) => {
    const u = URL.createObjectURL(b);
    urls.current.push(u);
    return u;
  };

  // Start from the pages already on the server.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      initialUrls.map(async (u) => {
        const blob = await fetch(u, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`page download failed (${r.status})`);
          return r.blob();
        });
        const bmp = await createImageBitmap(blob);
        const p: Page = { blob, width: bmp.width, height: bmp.height, cropped: false, url: objectUrl(blob), changed: false };
        bmp.close();
        return p;
      }),
    )
      .then((ps) => !cancelled && setPages(ps))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [initialUrls]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    const el = camera.current;
    const clear = () => (target.current = null);
    el?.addEventListener("cancel", clear);
    return () => el?.removeEventListener("cancel", clear);
  }, []);

  function shoot(index: number | null) {
    target.current = index;
    camera.current?.click();
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !pages) return;
    setBusy(true);
    setError(null);
    try {
      const processed = await processPhoto(file, { autoCrop: settings.autoCrop });
      const page: Page = { ...processed, url: objectUrl(processed.blob), changed: true };
      const next = [...pages];
      const at = target.current;
      if (at !== null && at < next.length) next.splice(at, 1, page);
      else next.push(page);
      setPages(next);
    } catch (e) {
      setError(`Could not read photo: ${(e as Error).message}`);
    } finally {
      target.current = null;
      setBusy(false);
      if (camera.current) camera.current.value = "";
    }
  }

  function update(fn: (ps: Page[]) => Page[]) {
    if (pages) setPages(fn([...pages]));
  }

  async function submit() {
    if (!pages?.length) return;
    setBusy(true);
    setError(null);
    const base = `/api/applications/${encodeURIComponent(token)}`;
    const call = async (url: string, init: RequestInit) => {
      const r = await fetch(url, init);
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `${r.status} ${r.statusText}`);
      return body;
    };
    try {
      setProgress("Starting…");
      await call(`${base}/rescan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_count: pages.length, staff: settings.staff || "unknown" }),
      });
      for (let i = 0; i < pages.length; i++) {
        setProgress(`Uploading page ${i + 1} of ${pages.length}…`);
        await call(`${base}/pages/${i}`, { method: "PUT", headers: { "Content-Type": pages[i].blob.type || "image/jpeg" }, body: pages[i].blob });
      }
      setProgress("Starting AI reading…");
      await call(`${base}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      onDone();
    } catch (e) {
      setError(`${(e as Error).message}. Nothing is lost — tap “Upload & read again” to retry.`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const changed = !!pages && (pages.length !== initialUrls.length || pages.some((p) => p.changed));

  return (
    <section className="mb-4 rounded-2xl border-2 border-forest-700 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-extrabold">
        पुन्हा स्कॅन करा <span className="text-sm font-semibold text-muted">· Rescan pages</span>
      </h3>
      <p className="text-sm text-muted">Retake a blurred or cut-off page, add a missed page, or remove a wrong one. The token stays the same.</p>

      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files)} />

      {!pages && !error && <p className="mt-3 text-sm">Loading current pages…</p>}

      {pages && (
        <ol className="mt-3 grid grid-cols-2 gap-3">
          {pages.map((p, i) => (
            <li key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              <img src={p.url} alt={`Page ${i + 1}`} className={`aspect-[3/4] w-full rounded-xl border-2 object-cover ${p.changed ? "border-forest-600" : "border-line"}`} />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-forest-700 px-2 text-sm font-bold text-white">{i + 1}</span>
              {p.changed && <span className="absolute right-1.5 top-1.5 rounded-full bg-forest-600 px-1.5 text-[11px] font-bold text-white">new</span>}
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button disabled={busy} onClick={() => shoot(i)} className="h-11 rounded-lg bg-forest-700 text-sm font-semibold text-white disabled:opacity-40">
                  📷 Retake
                </button>
                <button
                  disabled={busy || pages.length === 1}
                  onClick={() => update((ps) => ps.filter((_, k) => k !== i))}
                  className="h-11 rounded-lg border border-danger-600 text-sm font-semibold text-danger-600 disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
              {p.cropped && p.original && (
                <button
                  disabled={busy}
                  onClick={() =>
                    update((ps) => {
                      const o = ps[i].original!;
                      ps[i] = { blob: o.blob, width: o.width, height: o.height, cropped: false, url: objectUrl(o.blob), changed: true };
                      return ps;
                    })
                  }
                  className="mt-1 h-9 w-full rounded-lg bg-yellow-100 text-xs font-semibold text-yellow-900 ring-1 ring-yellow-400"
                >
                  ✂ Use full photo
                </button>
              )}
            </li>
          ))}
          <li>
            <button
              disabled={busy}
              onClick={() => shoot(null)}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-forest-600 text-forest-800 disabled:opacity-40"
            >
              <span className="text-3xl">＋</span>
              <span className="text-sm font-semibold">Add page</span>
            </button>
          </li>
        </ol>
      )}

      {progress && <p className="mt-3 rounded-lg bg-forest-50 p-2 text-sm font-semibold">{progress}</p>}
      {error && <p className="mt-3 rounded-lg bg-danger-50 p-2 text-sm text-danger-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button disabled={busy} onClick={onCancel} className="min-h-14 rounded-2xl border-2 border-line px-4 font-semibold disabled:opacity-40">
          रद्द
          <span className="block text-xs font-normal">Cancel</span>
        </button>
        <button
          disabled={busy || !changed}
          onClick={() => void submit()}
          className="min-h-14 flex-1 rounded-2xl bg-forest-700 px-3 font-bold leading-tight text-white disabled:bg-gray-400"
        >
          अपलोड व पुन्हा वाचा
          <span className="block text-xs font-semibold opacity-90">Upload & read again</span>
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">The current AI reading is replaced. Every rescan is recorded in the audit log.</p>
    </section>
  );
}
