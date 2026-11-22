"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BigButton, Header, Page } from "@/components/Header";
import { LiveCamera } from "@/components/LiveCamera";
import { TokenCard } from "@/components/TokenCard";
import { deleteApp, getDraft, getPages, patchApp, putApp, setPages, type LocalPage } from "@/lib/client/db";
import { processPhoto, type ProcessedPage } from "@/lib/client/image";
import { useSettings } from "@/lib/client/settings";
import { syncNow } from "@/lib/client/sync";
import { generateToken } from "@/lib/token";

type Thumb = LocalPage & { url: string };

export default function CapturePage() {
  const [settings, hydrated] = useSettings();
  const [token, setToken] = useState<string | null>(null);
  const [pages, setPagesState] = useState<Thumb[]>([]);
  const [issued, setIssued] = useState<{ token: string; pages: number } | null>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Thumb | null>(null);
  const [useCameraApp, setUseCameraApp] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const retakeAt = useRef<number | null>(null);

  const loadPages = useCallback(async (t: string) => {
    const ps = await getPages(t);
    setPagesState((old) => {
      old.forEach((p) => URL.revokeObjectURL(p.url));
      return ps.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
    });
  }, []);

  // Resume the unfinished draft (survives app close, backgrounding, screen lock) or start one.
  const startDraft = useCallback(async () => {
    const draft = await getDraft();
    if (draft) {
      setToken(draft.token);
      await loadPages(draft.token);
      return;
    }
    const t = generateToken(settings.venue);
    await putApp({
      token: t,
      venue: settings.venue,
      captured_at: new Date().toISOString(),
      captured_by: settings.staff || null,
      state: "draft",
      page_count: 0,
      pages_uploaded: [],
      created_on_server: false,
      read_requested: false,
    });
    setToken(t);
    setPagesState([]);
  }, [settings.venue, settings.staff, loadPages]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the IndexedDB draft once settings are known
    if (hydrated && !issued) void startDraft().catch((e) => setError(String(e)));
  }, [hydrated, issued, startDraft]);

  // If the camera app is cancelled during a retake, don't let the next photo replace that page.
  useEffect(() => {
    const el = cameraInput.current;
    const clear = () => (retakeAt.current = null);
    el?.addEventListener("cancel", clear);
    return () => el?.removeEventListener("cancel", clear);
  }, []);

  // Keep the screen awake while capturing at the counter.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const acquire = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  async function savePages(next: Omit<LocalPage, "key" | "idx" | "token">[]) {
    if (!token) return;
    await setPages(token, next);
    await loadPages(token);
  }

  async function addProcessed(list: ProcessedPage[]) {
    const current = (await getPages(token!)).map(({ blob, width, height, cropped }) => ({ blob, width, height, cropped }));
    const at = retakeAt.current;
    retakeAt.current = null;
    if (at !== null && at < current.length) current.splice(at, 1, ...list);
    else current.push(...list);
    await savePages(current);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !token) return;
    setError(null);
    setBusy((n) => n + files.length);
    const out: ProcessedPage[] = [];
    for (const f of Array.from(files)) {
      try {
        out.push(await processPhoto(f, { autoCrop: settings.autoCrop }));
      } catch (e) {
        setError(`Could not read photo: ${(e as Error).message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (out.length) await addProcessed(out);
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  async function move(i: number, dir: -1 | 1) {
    const ps = pages.map(({ blob, width, height, cropped }) => ({ blob, width, height, cropped }));
    const j = i + dir;
    if (j < 0 || j >= ps.length) return;
    [ps[i], ps[j]] = [ps[j], ps[i]];
    await savePages(ps);
  }

  async function remove(i: number) {
    await savePages(pages.filter((_, k) => k !== i).map(({ blob, width, height, cropped }) => ({ blob, width, height, cropped })));
    setPreview(null);
  }

  async function issueToken() {
    if (!token || pages.length === 0) return;
    await patchApp(token, {
      state: "queued",
      page_count: pages.length,
      captured_at: new Date().toISOString(),
      captured_by: settings.staff || null,
    });
    setIssued({ token, pages: pages.length });
    setToken(null);
    navigator.vibrate?.([60, 40, 60]);
    void syncNow();
  }

  async function discard() {
    if (!token || !confirm("हा अर्ज रद्द करायचा? Discard these photos?")) return;
    await deleteApp(token);
    setPagesState([]);
    setToken(null);
    await startDraft();
  }

  if (issued) {
    return (
      <>
        <Header title="टोकन · Token issued" back="/" />
        <Page>
          <TokenCard token={issued.token} pages={issued.pages} />
          <p className="mt-3 rounded-xl bg-forest-50 p-3 text-center text-sm">
            Saved on this phone. It uploads and the AI reads it in the background — verify it from the queue.
          </p>
          <div className="mt-4 space-y-3">
            <BigButton mr="पुढील नागरिक" en="Next citizen" onClick={() => setIssued(null)} />
            <BigButton variant="secondary" mr="अर्ज यादी" en="Go to queue" href="/queue" />
          </div>
        </Page>
      </>
    );
  }

  const live = settings.liveCamera && !useCameraApp;

  return (
    <>
      <Header title="स्कॅन · Scan pages" back="/" />
      <Page>
        {/* Default path (PRD §6): the phone's own camera app — full resolution, no permission prompt. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void onFiles(e.target.files)}
        />

        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="text-sm text-muted">Pages · पाने</div>
            <div className="text-3xl font-extrabold">{pages.length}</div>
          </div>
          {token && <div className="token-text text-sm text-muted">{token}</div>}
        </div>

        {live ? (
          <LiveCamera
            autoCrop={settings.autoCrop}
            onCapture={(p) => void addProcessed([p])}
            onUseCameraApp={() => {
              setUseCameraApp(true);
              cameraInput.current?.click();
            }}
          />
        ) : (
          <button
            onClick={() => cameraInput.current?.click()}
            disabled={!token}
            className="flex min-h-40 w-full flex-col items-center justify-center rounded-3xl border-4 border-dashed border-forest-600 bg-white p-6 text-forest-800 active:bg-forest-50"
          >
            <span className="text-5xl" aria-hidden>📷</span>
            <span className="mt-2 text-xl font-extrabold">
              {pages.length ? `पान ${pages.length + 1} चा फोटो घ्या` : "पहिल्या पानाचा फोटो घ्या"}
            </span>
            <span className="text-sm font-semibold">
              {pages.length ? `Photograph page ${pages.length + 1}` : "Photograph the first page"}
            </span>
          </button>
        )}

        <div className="mt-2 flex justify-between text-sm">
          <button onClick={() => galleryInput.current?.click()} className="px-1 py-2 text-forest-700 underline underline-offset-4">
            गॅलरीतून निवडा · From gallery
          </button>
          {settings.liveCamera && (
            <button onClick={() => setUseCameraApp((v) => !v)} className="px-1 py-2 text-forest-700 underline underline-offset-4">
              {useCameraApp ? "Live view" : "Camera app"}
            </button>
          )}
        </div>

        {busy > 0 && <p className="mt-2 rounded-xl bg-forest-50 p-3 text-center font-semibold">Processing {busy} photo(s)…</p>}
        {error && <p className="mt-2 rounded-xl bg-danger-50 p-3 text-danger-600">{error}</p>}

        {pages.length > 0 && (
          <ol className="mt-4 grid grid-cols-3 gap-3">
            {pages.map((p, i) => (
              <li key={p.key} className="relative">
                <button onClick={() => setPreview(p)} className="block w-full overflow-hidden rounded-xl border-2 border-line bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                  <img src={p.url} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                </button>
                <span className="absolute left-1.5 top-1.5 rounded-full bg-forest-700 px-2 text-sm font-bold text-white">{i + 1}</span>
                <div className="mt-1 flex justify-between">
                  <button onClick={() => void move(i, -1)} disabled={i === 0} className="h-10 w-10 rounded-lg border border-line bg-white disabled:opacity-30" aria-label="Move earlier">‹</button>
                  <button onClick={() => void move(i, 1)} disabled={i === pages.length - 1} className="h-10 w-10 rounded-lg border border-line bg-white disabled:opacity-30" aria-label="Move later">›</button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 p-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-2xl gap-2">
            {pages.length > 0 && (
              <button onClick={() => void discard()} className="rounded-2xl border-2 border-danger-600 px-4 font-semibold text-danger-600">
                रद्द
                <span className="block text-xs">Discard</span>
              </button>
            )}
            <div className="flex-1">
              <BigButton
                mr={`टोकन द्या${pages.length ? ` (${pages.length} पाने)` : ""}`}
                en="Done — issue token"
                onClick={() => void issueToken()}
                disabled={pages.length === 0 || busy > 0}
              />
            </div>
          </div>
        </div>

        {preview && (
          <div className="fixed inset-0 z-30 flex flex-col bg-black/95" role="dialog">
            <div className="flex items-center justify-between p-3 text-white">
              <span className="font-bold">Page {preview.idx + 1}{preview.cropped ? " · auto-cropped" : ""}</span>
              <button onClick={() => setPreview(null)} className="h-11 rounded-lg bg-white/15 px-4">Close</button>
            </div>
            <div className="flex-1 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
              <img src={preview.url} alt="" className="mx-auto max-w-none" style={{ width: "100%" }} />
            </div>
            <div className="flex gap-2 p-3">
              <button onClick={() => void remove(preview.idx)} className="flex-1 rounded-xl bg-danger-600 py-3 font-semibold text-white">
                हे पान काढा · Delete page
              </button>
              <button
                onClick={() => {
                  retakeAt.current = preview.idx;
                  setPreview(null);
                  cameraInput.current?.click();
                }}
                className="flex-1 rounded-xl bg-white py-3 font-semibold"
              >
                पुन्हा घ्या · Retake
              </button>
            </div>
          </div>
        )}

        {!hydrated || token ? null : (
          <p className="mt-4 text-center text-muted">
            Loading… <Link href="/" className="underline">Home</Link>
          </p>
        )}
      </Page>
    </>
  );
}
