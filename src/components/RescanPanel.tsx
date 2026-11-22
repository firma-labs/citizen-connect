"use client";

import { useEffect, useRef, useState } from "react";
import { processPhoto, type ProcessedPage } from "@/lib/client/image";
import { useSettings } from "@/lib/client/settings";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Notice } from "./ui/Notice";

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
  const { t } = useI18n();
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
      setError(t("capture.readError", { msg: (e as Error).message }));
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
      setProgress(t("rescan.starting"));
      await call(`${base}/rescan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_count: pages.length, staff: settings.staff || "unknown" }),
      });
      for (let i = 0; i < pages.length; i++) {
        setProgress(t("rescan.uploading", { a: i + 1, b: pages.length }));
        await call(`${base}/pages/${i}`, { method: "PUT", headers: { "Content-Type": pages[i].blob.type || "image/jpeg" }, body: pages[i].blob });
      }
      setProgress(t("rescan.reading"));
      await call(`${base}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      onDone();
    } catch (e) {
      setError(t("rescan.error", { msg: (e as Error).message }));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const changed = !!pages && (pages.length !== initialUrls.length || pages.some((p) => p.changed));

  return (
    <section className="mb-5 card bg-gradient-to-br from-indigo-50 via-white to-sky-50/50 p-5" aria-labelledby="rescan-title">
      <h2 id="rescan-title" className="text-[1.2rem] font-bold">
        {t("rescan.title")}
      </h2>
      <p className="mt-1 text-ink-2">{t("rescan.body")}</p>

      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files)} />

      {!pages && !error && <p className="mt-3 text-ink-3">{t("rescan.loading")}</p>}

      {pages && (
        <ol className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {pages.map((p, i) => (
            <li key={p.url}>
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                <img
                  src={p.url}
                  alt={t("capture.page", { n: i + 1 })}
                  className={`aspect-[3/4] w-full rounded-[var(--radius-control)] object-cover ${p.changed ? "ring-[3px] ring-sky-500" : "ring-1 ring-rule"}`}
                />
                <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-ink px-2 text-[0.85rem] font-bold text-white">{i + 1}</span>
                {p.changed && <span className="absolute right-2 top-2 rounded-full bg-sky-500 px-2 py-0.5 text-[0.78rem] font-bold text-white">{t("rescan.new")}</span>}
              </div>
              <div className="mt-2 grid gap-1.5">
                <Button size="md" icon="camera" disabled={busy} onClick={() => shoot(i)}>
                  {t("rescan.retake")}
                </Button>
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
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-marigold-50 text-[0.92rem] font-semibold text-marigold-700 ring-1 ring-inset ring-marigold-500"
                  >
                    <Icon name="crop" size={18} />
                    {t("rescan.useFull")}
                  </button>
                )}
                <Button variant="quiet" icon="trash" disabled={busy || pages.length === 1} onClick={() => update((ps) => ps.filter((_, k) => k !== i))} className="text-red-600">
                  {t("rescan.remove")}
                </Button>
              </div>
            </li>
          ))}
          <li>
            <button
              disabled={busy}
              onClick={() => shoot(null)}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-control)] border-2 border-dashed border-indigo-200 bg-white/60 text-indigo-800 disabled:opacity-40"
            >
              <Icon name="plus" size={32} />
              <span className="font-semibold">{t("rescan.add")}</span>
            </button>
          </li>
        </ol>
      )}

      {progress && (
        <Notice tone="info" role="status" className="mt-4">
          {progress}
        </Notice>
      )}
      {error && (
        <Notice tone="error" role="alert" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t("rescan.cancel")}
        </Button>
        <Button size="lg" icon="upload" className="flex-1" disabled={busy || !changed} onClick={() => void submit()}>
          {t("rescan.submit")}
        </Button>
      </div>
      <p className="mt-2 text-[0.88rem] text-ink-3">{t("rescan.note")}</p>
    </section>
  );
}
