"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { processPhoto, processVideoFrame, type ProcessedPage } from "@/lib/client/image";

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
      setError(window.isSecureContext ? "This browser has no camera API." : "Camera needs HTTPS. Open the https:// link.");
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
      <div className="rounded-2xl border-2 border-danger-600 bg-danger-50 p-4">
        <p className="text-lg font-bold">कॅमेरा परवानगी नाकारली · Camera permission denied</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px]">
          <li>In Chrome, tap the icon left of the address bar (🔒 or ⚙).</li>
          <li>Tap <b>Permissions → Camera → Allow</b>.</li>
          <li>Come back here and tap <b>Try again</b>.</li>
        </ol>
        <p className="mt-2 text-sm text-muted">
          Android: also check Settings → Apps → Chrome → Permissions → Camera.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void start()} className="rounded-xl bg-forest-700 px-4 py-3 font-semibold text-white">
            Try again
          </button>
          <button onClick={onUseCameraApp} className="rounded-xl border-2 border-forest-700 bg-white px-4 py-3 font-semibold text-forest-800">
            Use phone camera app instead
          </button>
        </div>
      </div>
    );
  }

  if (state === "unavailable" || state === "error") {
    return (
      <div className="rounded-2xl border-2 border-warn-500 bg-warn-50 p-4">
        <p className="font-bold">Live camera not available</p>
        <p className="text-sm">{error || "No rear camera found."}</p>
        <button onClick={onUseCameraApp} className="mt-3 rounded-xl bg-forest-700 px-4 py-3 font-semibold text-white">
          Use phone camera app
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} playsInline muted className="block aspect-[3/4] w-full object-cover" />
      {/* A4 portrait guide */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative aspect-[1/1.414] h-[88%] rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
          {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "left-0 bottom-0 border-l-4 border-b-4", "right-0 bottom-0 border-r-4 border-b-4"].map((c) => (
            <span key={c} className={`absolute h-8 w-8 border-green-300 ${c}`} />
          ))}
        </div>
      </div>
      {state !== "live" && (
        <div className="absolute inset-0 grid place-items-center text-white">{state === "paused" ? "Paused" : "Starting camera…"}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/70 to-transparent p-4">
        <button
          onClick={() => void capture()}
          disabled={busy || state !== "live"}
          aria-label="Capture page"
          className="h-20 w-20 rounded-full border-[6px] border-white bg-white/30 disabled:opacity-40 active:bg-white"
        />
      </div>
    </div>
  );
}
