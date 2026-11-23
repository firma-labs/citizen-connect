"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CornerEditor } from "scanic";
import { blobToImage, reprocessPage, type PageEdits, type ProcessedPage, type Rotation } from "@/lib/client/image";
import { useI18n } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

/**
 * Full-screen view of one scanned page: check it, rotate it, drag its corners
 * (scanic's corner editor, with a magnifier), or switch between a clean "scan"
 * and the photo's own colours (for photographs and ID pictures). `children`
 * adds screen-specific actions such as delete and retake.
 */
export function PageEditor({
  title,
  page,
  url,
  onSave,
  onClose,
  children,
}: {
  title: string;
  page: ProcessedPage;
  url: string;
  onSave: (next: ProcessedPage) => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"view" | "corners">("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = !!page.original && !!page.edits;

  async function apply(edits: PageEdits) {
    setBusy(true);
    setError(null);
    try {
      await onSave(await reprocessPage(page, edits));
      setMode("view");
    } catch (e) {
      setError(t("capture.readError", { msg: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  const button =
    "flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-white/10 px-3 font-semibold text-white ring-1 ring-inset ring-white/30 disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between gap-2 p-3 text-white" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <span className="font-semibold">{mode === "corners" ? t("scan.cornersHint") : title}</span>
        {mode === "view" && (
          <button onClick={onClose} className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-white/15 px-4 font-semibold">
            <Icon name="close" size={20} />
            {t("capture.close")}
          </button>
        )}
      </div>

      {mode === "corners" && page.original && page.edits ? (
        <Corners page={page} edits={page.edits} busy={busy} onApply={(corners) => void apply({ ...page.edits!, corners })} onCancel={() => setMode("view")} />
      ) : (
        <>
          <div className="relative min-h-0 flex-1 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
            <img src={url} alt="" className={`mx-auto w-full max-w-3xl transition-opacity ${busy ? "opacity-40" : ""}`} />
            {busy && (
              <p role="status" className="absolute inset-x-0 top-1/3 text-center text-[1.1rem] font-semibold text-white">
                {t("scan.working")}
              </p>
            )}
          </div>
          <div className="space-y-2 bg-ink p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <div className="mx-auto max-w-3xl space-y-2">
              {editable && !page.cropped && (
                <p className="rounded-[var(--radius-control)] bg-marigold-50 px-3 py-2 text-[0.92rem] font-semibold text-marigold-700">{t("scan.notFound")}</p>
              )}
              {error && (
                <p role="alert" className="rounded-[var(--radius-control)] bg-red-50 px-3 py-2 text-[0.92rem] font-semibold text-red-700">
                  {error}
                </p>
              )}
              {editable && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button disabled={busy} className={button} onClick={() => setMode("corners")}>
                      <Icon name="corners" size={20} />
                      {t("scan.corners")}
                    </button>
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => void apply({ ...page.edits!, rotation: (((page.edits!.rotation + 90) % 360) as Rotation) })}
                    >
                      <Icon name="rotate" size={20} />
                      {t("scan.rotate")}
                    </button>
                  </div>
                  <div role="radiogroup" aria-label={t("scan.look")} className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-white/10 p-1">
                    {([true, false] as const).map((clean) => {
                      const on = page.edits!.clean === clean;
                      return (
                        <button
                          key={String(clean)}
                          role="radio"
                          aria-checked={on}
                          disabled={busy}
                          onClick={() => !on && void apply({ ...page.edits!, clean })}
                          className={`min-h-11 rounded-[10px] font-semibold ${on ? "bg-white text-ink" : "text-white"}`}
                        >
                          {t(clean ? "scan.clean" : "scan.photo")}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-center text-[0.85rem] text-white/75">{t("scan.lookHint")}</p>
                </>
              )}
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** scanic's corner editor on the original photo, with our own localized buttons. */
function Corners({
  page,
  edits,
  busy,
  onApply,
  onCancel,
}: {
  page: ProcessedPage;
  edits: PageEdits;
  busy: boolean;
  onApply: (corners: NonNullable<PageEdits["corners"]>) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<CornerEditor | null>(null);
  const [ready, setReady] = useState(false);
  const { width: w, height: h } = page.original!;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const [{ createCornerEditor }, img] = await Promise.all([import("scanic"), blobToImage(page.original!.blob)]);
      if (disposed || !host.current) return;
      editor.current = createCornerEditor({
        container: host.current,
        image: img,
        corners: edits.corners ?? edits.detected ?? undefined,
        magnifier: { zoom: 2.5, size: 120 },
        toolbar: { enabled: false },
        handleHitArea: 48,
        theme: { accent: "#6b55e0", mask: "rgba(28, 31, 51, 0.55)", handleColor: "#ffffff", handleRingColor: "#6b55e0", handleSize: 22 },
      });
      setReady(true);
    })().catch((e) => console.warn("corner editor failed", e));
    return () => {
      disposed = true;
      editor.current?.destroy();
      editor.current = null;
    };
  }, [page.original, edits]);

  const whole = { topLeft: { x: 0, y: 0 }, topRight: { x: w, y: 0 }, bottomRight: { x: w, y: h }, bottomLeft: { x: 0, y: h } };
  const button =
    "flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-white/10 px-3 font-semibold text-white ring-1 ring-inset ring-white/30 disabled:opacity-40";

  return (
    <>
      <div ref={host} className="relative min-h-0 flex-1 touch-none" />
      <div className="bg-ink p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2">
          <button disabled={!ready || busy} className={button} onClick={() => editor.current?.setCorners(whole)}>
            {t("scan.whole")}
          </button>
          <button disabled={!ready || busy || !edits.detected} className={button} onClick={() => edits.detected && editor.current?.setCorners(edits.detected)}>
            {t("scan.auto")}
          </button>
          <button disabled={busy} className={button} onClick={onCancel}>
            {t("scan.cancel")}
          </button>
          <button
            disabled={!ready || busy}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-white font-semibold text-ink disabled:opacity-40"
            onClick={() => editor.current && onApply(editor.current.getCorners())}
          >
            <Icon name="check" size={20} />
            {busy ? t("scan.working") : t("scan.apply")}
          </button>
        </div>
      </div>
    </>
  );
}
