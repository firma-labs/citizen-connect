"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { processPhoto, processVideoFrame, type ProcessedPage } from "@/lib/client/image";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

type CamState = "starting" | "live" | "denied" | "unavailable" | "error" | "paused";

/**
 * Optional live preview with an A4 edge guide (PRD §6, behind a setting).
 * The default capture path is the phone's own camera app via a file input.
 * Stops the stream when the page is hidden (backgrounded / screen locked) and
 * restarts when visible, so a locked phone doesn't leave the camera running.
 */
export function LiveCamera({
  autoCrop,
  onCapture,
  onUseCameraApp,
}: {
  autoCrop: boolean;
  onCapture: (p: ProcessedPage) => void;
  onUseCameraApp: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CamState>("starting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      setError(window.isSecureContext ? "" : "https");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState("live");
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === "NotAllowedError" || name === "SecurityError") setState("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setState("unavailable");
      else {
        setState("error");
        setError((e as Error).message);
      }
    }
  }, [stop]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting an external device stream
    void start();
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        stop();
        setState("paused");
      } else void start();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [start, stop]);

  async function capture() {
    const video = videoRef.current;
    if (!video || state !== "live") return;
    setBusy(true);
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      // Full sensor resolution where supported (Chrome Android), else a video frame.
      const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
      let page: ProcessedPage;
      if (IC && track) {
        try {
          page = await processPhoto(await new IC(track).takePhoto(), { autoCrop });
        } catch {
          page = await processVideoFrame(video, { autoCrop });
        }
      } else {
        page = await processVideoFrame(video, { autoCrop });
      }
      navigator.vibrate?.(40);
      onCapture(page);
    } finally {
      setBusy(false);
    }
  }

  if (state === "denied") {
    return (
      <Notice tone="error" title={t("cam.denied.title")}>
        <ol className="list-decimal space-y-1 pl-5">
          <li>{t("cam.denied.1")}</li>
          <li>{t("cam.denied.2")}</li>
          <li>{t("cam.denied.3")}</li>
        </ol>
        <p className="mt-2 text-[0.9rem]">{t("cam.denied.android")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button icon="refresh" onClick={() => void start()}>
            {t("cam.retry")}
          </Button>
          <Button variant="secondary" icon="camera" onClick={onUseCameraApp}>
            {t("cam.useApp")}
          </Button>
        </div>
      </Notice>
    );
  }

  if (state === "unavailable" || state === "error") {
    return (
      <Notice tone="attention" title={t("cam.unavailable")}>
        <p>{error === "https" ? t("cam.https") : error || t("cam.noRear")}</p>
        <Button className="mt-3" icon="camera" onClick={onUseCameraApp}>
          {t("cam.useApp")}
        </Button>
      </Notice>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-panel)] bg-ink">
      <video ref={videoRef} playsInline muted className="block aspect-[3/4] w-full object-cover" />
      {/* A4 portrait guide */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative aspect-[1/1.414] h-[88%] rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
          {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "left-0 bottom-0 border-l-4 border-b-4", "right-0 bottom-0 border-r-4 border-b-4"].map((c) => (
            <span key={c} className={`absolute h-8 w-8 border-marigold-500 ${c}`} />
          ))}
        </div>
      </div>
      {state !== "live" && (
        <div className="absolute inset-0 grid place-items-center text-white">{state === "paused" ? t("cam.paused") : t("cam.starting")}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/70 to-transparent p-4">
        <button
          onClick={() => void capture()}
          disabled={busy || state !== "live"}
          aria-label={t("cam.capture")}
          className="h-20 w-20 rounded-full border-[6px] border-white bg-white/30 disabled:opacity-40 active:bg-white"
        />
      </div>
    </div>
  );
}
