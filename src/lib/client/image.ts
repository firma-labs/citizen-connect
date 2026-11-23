"use client";

// Turns a phone photo of a letter into a clean, straight page — like a
// document scanner app — using two libraries:
//
//   scanic     finds the page's four corners and straightens it (perspective
//              correction), and provides the drag-the-corners editor.
//   OpenCV.js  removes shadows and uneven light and whitens the paper
//              (background division: dilate + median blur → divide).
//
// Everything runs on the phone, so scanning works offline. The photo itself is
// kept on the device so staff can re-adjust corners, rotate, or switch between
// "scan" and "photo" until the token is issued.

import type { CornerPoints } from "scanic";

/** Long edge of the page that is stored and read by the AI. */
const MAX_EDGE = 2200;
/** Long edge of the photo kept on the device for re-editing. */
const ORIGINAL_EDGE = 3000;
const QUALITY = 0.85;
/** Served from public/vendor (copied from @techstark/opencv-js by scripts/copy-vendor.mjs). Keep the version in step with package.json. */
const OPENCV_URL = "/vendor/opencv-4.12.0.js";

export type Corners = CornerPoints;
export type Rotation = 0 | 90 | 180 | 270;

export interface PageEdits {
  /** Page corners in the original photo's pixels; null = use the whole photo. */
  corners: Corners | null;
  /** What automatic detection found (null = no page edges found). */
  detected: Corners | null;
  rotation: Rotation;
  /** Remove shadows and whiten the paper ("scan"); false keeps the photo's colours ("photo"). */
  clean: boolean;
}

export interface ProcessedPage {
  blob: Blob;
  width: number;
  height: number;
  /** True when the page was straightened to its edges. */
  cropped: boolean;
  /** The photo as taken, kept on the device for re-editing. */
  original?: { blob: Blob; width: number; height: number };
  edits?: PageEdits;
}

// ---------------------------------------------------------------- libraries

let scanicP: Promise<typeof import("scanic")> | null = null;
const loadScanic = () => (scanicP ??= import("scanic"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenCV.js ships no usable types
type CV = any;
let cvP: Promise<{ cv: CV }> | null = null;
/** Load OpenCV.js once (cached by the service worker for offline use). Resolves with a wrapper: the module object is thenable. */
function loadOpenCv(): Promise<{ cv: CV }> {
  cvP ??= new Promise<{ cv: CV }>((resolve, reject) => {
    const w = window as unknown as { cv?: CV };
    const ready = () => {
      const m = w.cv;
      if (!m) return reject(new Error("OpenCV.js did not load"));
      if (typeof m.Mat === "function") return resolve({ cv: m });
      if (m instanceof Promise) return void m.then((cv: CV) => resolve({ cv }), reject);
      m.onRuntimeInitialized = () => resolve({ cv: w.cv });
    };
    if (w.cv) return ready();
    const s = document.createElement("script");
    s.src = OPENCV_URL;
    s.async = true;
    s.onload = ready;
    s.onerror = () => reject(new Error("OpenCV.js failed to download"));
    document.head.appendChild(s);
  }).catch((e) => {
    cvP = null; // allow a retry later (e.g. once back online)
    throw e;
  });
  return cvP;
}

/** Start downloading the scanner libraries in the background (call when the capture screen opens). */
export function warmUpScanner() {
  const go = () => {
    loadScanic().catch(() => {});
    loadOpenCv().catch(() => {});
  };
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 500);
}

// ---------------------------------------------------------------- pipeline

/** Photo from the camera or gallery → straightened, cleaned page. */
export async function processPhoto(source: Blob, opts: { autoCrop: boolean }): Promise<ProcessedPage> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  let photo: HTMLCanvasElement;
  try {
    photo = scaled(bitmap, bitmap.width, bitmap.height, ORIGINAL_EDGE);
  } finally {
    bitmap.close();
  }
  const original = { blob: await toJpeg(photo, 0.9), width: photo.width, height: photo.height };
  const detected = await detectCorners(photo);
  const edits: PageEdits = { corners: opts.autoCrop ? detected : null, detected, rotation: 0, clean: opts.autoCrop };
  return { ...(await render(photo, edits)), original, edits };
}

/** Re-render a page after staff change its corners, rotation or scan/photo choice. */
export async function reprocessPage(page: ProcessedPage, edits: PageEdits): Promise<ProcessedPage> {
  if (!page.original) throw new Error("the original photo is not on this device");
  const photo = await decode(page.original.blob);
  return { ...(await render(photo, edits)), original: page.original, edits };
}

/** Decode a blob into an <img> (for the corner editor). */
export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  try {
    await img.decode();
  } finally {
    URL.revokeObjectURL(img.src);
  }
  return img;
}

async function detectCorners(photo: HTMLCanvasElement): Promise<Corners | null> {
  try {
    const { scanDocument } = await loadScanic();
    // 0.8: on test photos, real page edges scored 0.87–0.98, while a photo of a
    // screen gave a wrong, slanted quad at 0.68. Below it the whole photo is kept
    // (still cleaned) and the page is flagged "Check edges" for staff to drag.
    const r = await scanDocument(photo, { mode: "detect", maxProcessingDimension: 1000, minDetectionConfidence: 0.8 });
    return r.success && r.isValid !== false && r.corners ? r.corners : null;
  } catch (e) {
    console.warn("page edge detection failed", e);
    return null;
  }
}

async function render(photo: HTMLCanvasElement, edits: PageEdits) {
  let page = photo;
  let straightened = false;
  if (edits.corners) {
    try {
      const { extractDocument } = await loadScanic();
      const r = await extractDocument(photo, edits.corners, { output: "canvas" });
      if (r.success && r.output instanceof HTMLCanvasElement) {
        page = r.output;
        straightened = true;
      }
    } catch (e) {
      console.warn("straightening failed; keeping the whole photo", e);
    }
  }
  page = scaled(page, page.width, page.height, MAX_EDGE);
  if (edits.clean) page = await removeShadows(page);
  if (edits.rotation) page = rotated(page, edits.rotation);
  return { blob: await toJpeg(page, QUALITY), width: page.width, height: page.height, cropped: straightened };
}

/**
 * Shadow removal / paper whitening with OpenCV: estimate the paper's
 * brightness everywhere (dilate removes the ink, median blur smooths it —
 * done at quarter size for speed), then divide the page by it, so the paper
 * becomes white and ink stays dark, in colour. If OpenCV can't load (first
 * use with no signal), the page is kept as is.
 */
async function removeShadows(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  let cv: CV;
  try {
    ({ cv } = await loadOpenCv());
  } catch (e) {
    console.warn("OpenCV.js unavailable; page not cleaned", e);
    return canvas;
  }
  const mats: { delete(): void }[] = [];
  const keep = <T extends { delete(): void }>(m: T) => (mats.push(m), m);
  try {
    const rgba = keep(cv.imread(canvas));
    const rgb = keep(new cv.Mat());
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
    const small = keep(new cv.Mat());
    cv.resize(rgb, small, new cv.Size(0, 0), 0.25, 0.25, cv.INTER_AREA);
    const kernel = keep(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7)));
    const dilated = keep(new cv.Mat());
    cv.dilate(small, dilated, kernel);
    const blurred = keep(new cv.Mat());
    cv.medianBlur(dilated, blurred, 21);
    const background = keep(new cv.Mat());
    cv.resize(blurred, background, rgb.size(), 0, 0, cv.INTER_LINEAR);
    const flat = keep(new cv.Mat());
    cv.divide(rgb, background, flat, 255);
    const out = keep(new cv.Mat());
    flat.convertTo(out, -1, 1.15, -38); // a little more contrast: darker ink, paper stays white
    const result = document.createElement("canvas");
    cv.imshow(result, out);
    return result;
  } catch (e) {
    console.warn("page clean-up failed; keeping the page as is", e);
    return canvas;
  } finally {
    mats.forEach((m) => m.delete());
  }
}

// ---------------------------------------------------------------- canvas helpers

function scaled(src: CanvasImageSource, w: number, h: number, maxEdge: number): HTMLCanvasElement {
  const k = Math.min(1, maxEdge / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function rotated(src: HTMLCanvasElement, deg: Rotation): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const quarter = deg === 90 || deg === 270;
  c.width = quarter ? src.height : src.width;
  c.height = quarter ? src.width : src.height;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

async function decode(blob: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  try {
    return scaled(bmp, bmp.width, bmp.height, ORIGINAL_EDGE);
  } finally {
    bmp.close();
  }
}

function toJpeg(canvas: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode image"))), "image/jpeg", q),
  );
}
