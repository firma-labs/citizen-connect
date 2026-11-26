"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageEditor } from "@/components/PageEditor";
import { VenuePicker } from "@/components/VenuePicker";
import { AppBar, BottomNav, Screen } from "@/components/ui/AppBar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { TokenCard } from "@/components/TokenCard";
import { deleteApp, getDraft, getPages, patchApp, putApp, setPages, type LocalPage } from "@/lib/client/db";
import { processPhoto, warmUpScanner, type ProcessedPage } from "@/lib/client/image";
import { useSettings } from "@/lib/client/settings";
import { SAMPLE_LETTERS, type SampleLetter } from "@/lib/samples";
import { syncNow } from "@/lib/client/sync";
import { useI18n } from "@/lib/i18n";
import { generateToken } from "@/lib/token";

type Thumb = LocalPage & { url: string };

type PageInput = Omit<LocalPage, "key" | "idx" | "token">;
const pageInput = ({ blob, width, height, cropped, original, edits }: LocalPage): PageInput => ({ blob, width, height, cropped, original, edits });

export default function CapturePage() {
  const [settings, hydrated] = useSettings();
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [pages, setPagesState] = useState<Thumb[]>([]);
  const [issued, setIssued] = useState<{ token: string; pages: number; at: string } | null>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Thumb | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const retakeAt = useRef<number | null>(null);

  const loadPages = useCallback(async (t: string) => {
    const thumbs: Thumb[] = (await getPages(t)).map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
    setPagesState((old) => {
      old.forEach((p) => URL.revokeObjectURL(p.url));
      return thumbs;
    });
    return thumbs;
  }, []);

  // Fetch the scanner libraries (page straightening + clean-up) while staff get ready.
  useEffect(() => warmUpScanner(), []);

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
    if (!token) return [];
    await setPages(token, next);
    return loadPages(token);
  }

  async function addProcessed(list: ProcessedPage[]) {
    const current = (await getPages(token!)).map(pageInput);
    const at = retakeAt.current;
    retakeAt.current = null;
    if (at !== null && at < current.length) current.splice(at, 1, ...list);
    else current.push(...list);
    await savePages(current);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    await addPhotos(Array.from(files));
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  /** Sample letter: its pages go through the same straightening and clean-up as a photo. */
  async function addSample(sample: SampleLetter) {
    try {
      const blobs = await Promise.all(
        sample.pages.map((u) => fetch(u).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))),
      );
      await addPhotos(blobs);
    } catch (e) {
      setError(t("capture.readError", { msg: (e as Error).message }));
    }
  }

  async function addPhotos(files: Blob[]) {
    if (!files.length || !token) return;
    setError(null);
    setBusy((n) => n + files.length);
    const out: ProcessedPage[] = [];
    for (const f of files) {
      try {
        out.push(await processPhoto(f, { autoCrop: settings.autoCrop }));
      } catch (e) {
        setError(t("capture.readError", { msg: (e as Error).message }));
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (out.length) await addProcessed(out);
  }

  async function move(i: number, dir: -1 | 1) {
    const ps = pages.map(pageInput);
    const j = i + dir;
    if (j < 0 || j >= ps.length) return;
    [ps[i], ps[j]] = [ps[j], ps[i]];
    await savePages(ps);
  }

  /** Save a page edited in the page editor (corners, rotation, scan/photo) and keep showing it. */
  async function replacePage(i: number, next: ProcessedPage) {
    const ps = pages.map(pageInput);
    ps[i] = next;
    const thumbs = await savePages(ps);
    setPreview(thumbs[i] ?? null);
  }

  async function remove(i: number) {
    await savePages(pages.filter((_, k) => k !== i).map(pageInput));
    setPreview(null);
  }

  async function issueToken() {
    if (!token || pages.length === 0) return;
    const at = new Date().toISOString();
    await patchApp(token, {
      state: "queued",
      page_count: pages.length,
      captured_at: at,
      captured_by: settings.staff || null,
    });
    setIssued({ token, pages: pages.length, at });
    setToken(null);
    navigator.vibrate?.([60, 40, 60]);
    void syncNow();
  }

  /** A new venue needs a new token (its code is in the token): drop the empty draft; a new one starts with the new venue. */
  async function dropEmptyDraft() {
    if (!token || pages.length > 0) return;
    await deleteApp(token);
    setToken(null);
  }

  async function discard() {
    if (!token || !confirm(t("capture.discardConfirm"))) return;
    await deleteApp(token);
    setPagesState([]);
    setToken(null);
    await startDraft();
  }

  if (issued) {
    return (
      <>
        <AppBar title="token.title" back="/" />
        <Screen>
          <div className="rounded-[var(--radius-hero)] bg-gradient-to-br from-indigo-50 via-sky-50 to-mint-50 p-4 sm:p-6">
            <TokenCard token={issued.token} pages={issued.pages} issuedAt={issued.at} />
          </div>
          <p className="mx-auto mt-4 max-w-md text-center text-[0.92rem] text-ink-3">{t("token.saved")}</p>
          <div className="mx-auto mt-5 grid max-w-md gap-3">
            <Button size="lg" block icon="camera" onClick={() => setIssued(null)}>
              {t("token.next")}
            </Button>
            <Button variant="secondary" block href={`/verify?t=${encodeURIComponent(issued.token)}`}>
              {t("token.watch")}
            </Button>
            <Button variant="quiet" block href="/queue">
              {t("token.queue")}
            </Button>
          </div>
        </Screen>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <AppBar title="capture.title" back="/" />
      <Screen>
        {/* Default path (PRD §6): the phone's own camera app — full resolution, no permission prompt. */}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
        <input ref={galleryInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />

        {/* Today's Darbar: the token carries the venue code, so it can change only before the first page. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-ink-3">{t("home.today")}</span>
          <VenuePicker disabled={pages.length > 0} beforeChange={dropEmptyDraft} />
        </div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-ink-3">{t("capture.count")}</p>
            <p className="font-display text-[2.4rem] font-bold leading-none tracking-tight text-indigo-800">{pages.length}</p>
          </div>
          {token && <p className="token pb-1 text-[0.95rem] text-ink-3">{token}</p>}
        </div>

        <button
          onClick={() => cameraInput.current?.click()}
          disabled={!token}
          className="group relative isolate flex min-h-52 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[var(--radius-hero)] bg-gradient-to-br from-indigo-50 via-sky-50 to-mint-50 p-6 text-ink transition-[filter] hover:brightness-[0.98] active:brightness-95 disabled:opacity-50"
        >
          <span className="relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.25rem] bg-primary text-on-primary shadow-[var(--elevation-3)]">
            <Icon name="camera" size={32} />
          </span>
          <span className="relative text-[1.25rem] font-semibold leading-snug">
            {pages.length ? t("capture.next", { n: pages.length + 1 }) : t("capture.first")}
          </span>
        </button>
        <p className="mt-2 text-[0.92rem] text-ink-3">{t("capture.tip")}</p>

        <div className="mt-2 flex flex-wrap gap-x-2">
          <Button variant="quiet" icon="image" onClick={() => galleryInput.current?.click()}>
            {t("capture.gallery")}
          </Button>
        </div>

        {/* Sample letters for demos and testing, offered before the first page (Settings → App → Scanning hides them). */}
        {settings.showSamples !== false && pages.length === 0 && (
          <section aria-labelledby="samples-title" className="mt-5">
            <h2 id="samples-title" className="font-semibold">
              {t("samples.title")}
            </h2>
            <p className="text-[0.9rem] text-ink-3">{t("samples.hint")}</p>
            <ul className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
              {SAMPLE_LETTERS.map((s) => (
                <li key={s.id} className="min-w-0">
                  <button
                    onClick={() => void addSample(s)}
                    disabled={!token || busy > 0}
                    className="block w-full overflow-hidden rounded-[var(--radius-panel)] bg-surface-container text-left transition-colors hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <span className="relative block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- small static sample */}
                      <img src={s.pages[0]} alt="" className="aspect-[4/3] w-full object-cover object-top" loading="lazy" />
                      {s.pages.length > 1 && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-ink px-2.5 py-0.5 text-[0.78rem] font-semibold text-white">
                          {t("samples.pages", { n: s.pages.length })}
                        </span>
                      )}
                    </span>
                    <span className="block px-3 py-2">
                      <span className="block font-semibold leading-snug">{t(s.title)}</span>
                      <span className="block text-[0.82rem] text-ink-3">{t(s.meta)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {busy > 0 && (
          <Notice tone="info" role="status" className="mt-3">
            {t("capture.processing", { n: busy })}
          </Notice>
        )}
        {error && (
          <Notice tone="error" role="alert" className="mt-3">
            {error}
          </Notice>
        )}

        {pages.length > 0 && (
          <ol className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {pages.map((p, i) => (
              <li key={p.key}>
                <button
                  onClick={() => setPreview(p)}
                  className="relative block w-full overflow-hidden rounded-[var(--radius-panel)] border border-rule bg-surface shadow-[0_10px_24px_-18px_rgb(28_31_51/0.4)]"
                  aria-label={t("capture.page", { n: i + 1 })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                  <img src={p.url} alt="" className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute left-2 top-2 grid h-8 min-w-8 place-items-center rounded-full bg-ink px-2 text-[0.9rem] font-bold text-white">
                    {i + 1}
                  </span>
                  {p.original && !p.cropped && (
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-marigold-50/95 py-1 text-[0.82rem] font-semibold text-marigold-700">
                      <Icon name="corners" size={15} />
                      {t("capture.checkEdges")}
                    </span>
                  )}
                </button>
                <div className="mt-1.5 flex justify-between">
                  <button
                    onClick={() => void move(i, -1)}
                    disabled={i === 0}
                    aria-label={t("capture.earlier")}
                    className="grid h-12 w-12 place-items-center rounded-full text-ink-2 hover:bg-surface disabled:opacity-25"
                  >
                    <Icon name="back" />
                  </button>
                  <button
                    onClick={() => void move(i, 1)}
                    disabled={i === pages.length - 1}
                    aria-label={t("capture.later")}
                    className="grid h-12 w-12 place-items-center rounded-full text-ink-2 hover:bg-surface disabled:opacity-25"
                  >
                    <Icon name="next" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {/* room for the action bar stacked above the tab bar */}
        <div aria-hidden className="h-24 lg:h-16" />
      </Screen>

      {/* Issue-token bar: just above the bottom tab bar on phones, at the bottom on wide screens */}
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-10 border-t border-rule bg-surface/95 px-4 py-3 backdrop-blur-md lg:bottom-0">
        <div className="mx-auto flex max-w-2xl gap-3">
          {pages.length > 0 && (
            <Button variant="danger" size="lg" icon="trash" onClick={() => void discard()}>
              {t("capture.discard")}
            </Button>
          )}
          <Button size="lg" block onClick={() => void issueToken()} disabled={pages.length === 0 || busy > 0}>
            {t("capture.issue")}
          </Button>
        </div>
      </div>

      <BottomNav />

      {preview && (
        <PageEditor
          title={t("capture.page", { n: preview.idx + 1 })}
          page={preview}
          url={preview.url}
          onSave={(next) => replacePage(preview.idx, next)}
          onClose={() => setPreview(null)}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void remove(preview.idx)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-white/12 font-semibold text-white transition-colors hover:bg-white/20"
            >
              <Icon name="trash" size={20} />
              {t("capture.delete")}
            </button>
            <button
              onClick={() => {
                retakeAt.current = preview.idx;
                setPreview(null);
                cameraInput.current?.click();
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-button)] bg-white font-semibold text-ink"
            >
              <Icon name="camera" size={20} />
              {t("capture.retake")}
            </button>
          </div>
        </PageEditor>
      )}
    </>
  );
}
