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
/**
 * scanic's neural page detector: its loader (from scanic) and the model with
 * its runtime (from scanic-ml), served from public/vendor (copied by
 * scripts/copy-vendor.mjs). Keep the versions in step with package.json.
 */
const SCANIC_ML_LOADER = "/vendor/scanic-1.8.0/scanic-mlDetector.js";
const SCANIC_ML_URL = "/vendor/scanic-ml-0.2.0/";
/** The model's P(this photo shows a page); below it, the classical detector is tried. */
const ML_MIN_SCORE = 0.5;
/** A page covers at least this share of the photo... */
const PAGE_MIN_AREA = 0.2;
/** ...and its short side is at least this share of its long side (A4 is 0.71, legal 0.61). */
const PAGE_MIN_ASPECT = 0.5;
/** Share of each side trimmed off the straightened page, so no sliver of table shows at the edges. */
const EDGE_TRIM = 0.006;
/** Edge refinement works on a copy with this long edge. */
const REFINE_EDGE = 1400;
/** How far (share of the long edge) refinement looks either side of a rough side. */
const REFINE_REACH = 0.04;
const REFINE_SAMPLES = 48;
/** The brightness step is measured between these distances (px) either side of a point. */
const STEP_NEAR = 2;
const STEP_FAR = 6;
/** Smallest brightness step (0-255) that counts as the paper's edge. */
const REFINE_MIN_STEP = 18;

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
/** scanic's neural page detector (its dist file, served from public/vendor). */
interface MlDetector {
  detectDocumentMl(
    image: HTMLCanvasElement,
    options: { assetBaseUrl: string; minScore: number },
  ): Promise<{ success: boolean; corners: Corners | null; score: number | null }>;
  initializeMl(options: { assetBaseUrl: string }): Promise<void>;
}
let mlP: Promise<MlDetector> | null = null;
const loadMl = () =>
  (mlP ??= (import(/* webpackIgnore: true */ /* turbopackIgnore: true */ SCANIC_ML_LOADER) as Promise<MlDetector>).catch((e) => {
    mlP = null; // allow a retry later (e.g. once back online)
    throw e;
  }));

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
    loadMl()
      .then((m) => m.initializeMl({ assetBaseUrl: SCANIC_ML_URL }))
      .catch(() => {});
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
  return (await detectPage(photo, { detector: "ml", refine: true })) ?? (await detectPage(photo, { detector: "classical", refine: true }));
}

/**
 * Find the page's corners: a first estimate from scanic (its neural model, or
 * its classical edge tracer), then, optionally, each side snapped to the
 * paper's exact edge with OpenCV. Null when no page is found.
 */
export async function detectPage(
  photo: HTMLCanvasElement,
  opts: { detector: "ml" | "classical"; refine: boolean },
): Promise<Corners | null> {
  let rough: Corners | null = null;
  try {
    if (opts.detector === "ml") {
      const { detectDocumentMl } = await loadMl();
      const r = await detectDocumentMl(photo, { assetBaseUrl: SCANIC_ML_URL, minScore: ML_MIN_SCORE });
      rough = r.success && r.corners ? r.corners : null;
    } else {
      const { scanDocument } = await loadScanic();
      // 0.8: on test photos, real page edges scored 0.87–0.98, while a photo of a
      // screen gave a wrong, slanted quad at 0.68. Below it the whole photo is kept
      // (still cleaned) and the page is flagged "Check edges" for staff to drag.
      const r = await scanDocument(photo, { mode: "detect", maxProcessingDimension: 1000, minDetectionConfidence: 0.8 });
      rough = r.success && r.isValid !== false && r.corners ? r.corners : null;
    }
  } catch (e) {
    console.warn(`page edge detection (${opts.detector}) failed`, e);
    return null;
  }
  if (!rough || !looksLikePage(rough, photo.width, photo.height)) return null;
  if (!opts.refine) return rough;
  const refined = await refineCorners(photo, rough);
  if (refined === "rejected") return null;
  if (!refined) return rough; // OpenCV unavailable (first use offline): the rough outline
  return looksLikePage(refined, photo.width, photo.height) ? refined : null;
}

/**
 * Whether four corners plausibly outline a letter: a convex shape covering a
 * fair share of the photo, with a page's proportions even when seen at an
 * angle. The model can be sure of a wrong shape (e.g. a band across a laptop
 * screen showing a letter); those fall back to the next detector.
 */
function looksLikePage(c: Corners, W: number, H: number): boolean {
  const p = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft];
  const side = (i: number) => Math.hypot(p[(i + 1) % 4].x - p[i].x, p[(i + 1) % 4].y - p[i].y);
  const [top, right, bottom, left] = [0, 1, 2, 3].map(side);
  // Convex, corners in order: the turn at every corner has the same sign.
  const turns = p.map((a, i) => {
    const b = p[(i + 1) % 4];
    const d = p[(i + 2) % 4];
    return (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x);
  });
  if (!turns.every((t) => t > 0) && !turns.every((t) => t < 0)) return false;
  const area = Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % 4].y - p[(i + 1) % 4].x * a.y, 0)) / 2;
  if (area < PAGE_MIN_AREA * W * H) return false;
  const w = (top + bottom) / 2;
  const h = (left + right) / 2;
  if (Math.min(w, h) / Math.max(w, h) < PAGE_MIN_ASPECT) return false;
  // Opposite sides of similar length (a tilted phone shortens one, not by half).
  return Math.min(top, bottom) / Math.max(top, bottom) > 0.6 && Math.min(left, right) / Math.max(left, right) > 0.6;
}

/**
 * Snap each side of a rough page outline to the paper's real edge, as scanner
 * apps do. Along each side, look a short way inwards and outwards for the
 * biggest step in brightness from one side of the line to the other (paper
 * against table - a ruled line or a text line on the paper is not a step),
 * then fit a straight line through those points (OpenCV fitLine, robust to
 * stray points such as a finger); the corners are where neighbouring lines
 * meet. A side with no such edge along it is accepted only where it runs along
 * the photo's border (the page fills the photo there).
 *
 * Returns the refined corners; "rejected" when some side has no edge to stand
 * on (the rough outline is wrong); null when OpenCV is unavailable.
 */
async function refineCorners(photo: HTMLCanvasElement, rough: Corners): Promise<Corners | "rejected" | null> {
  let cv: CV;
  try {
    ({ cv } = await loadOpenCv());
  } catch {
    return null;
  }
  const work = scaled(photo, photo.width, photo.height, REFINE_EDGE);
  const k = work.width / photo.width;
  const W = work.width;
  const H = work.height;
  const mats: { delete(): void }[] = [];
  const keep = <T extends { delete(): void }>(m: T) => (mats.push(m), m);
  try {
    const rgba = keep(cv.imread(work));
    const grayMat = keep(new cv.Mat());
    cv.cvtColor(rgba, grayMat, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(grayMat, grayMat, new cv.Size(3, 3), 0);
    const gray: Uint8Array = grayMat.data;
    const at = (x: number, y: number) => gray[Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))];

    const pts = [rough.topLeft, rough.topRight, rough.bottomRight, rough.bottomLeft].map((p) => ({ x: p.x * k, y: p.y * k }));
    const reach = Math.max(W, H) * REFINE_REACH;
    type Line = { x: number; y: number; vx: number; vy: number };
    const BORDERS: Line[] = [
      { x: 0, y: 0, vx: 1, vy: 0 },
      { x: W, y: 0, vx: 0, vy: 1 },
      { x: 0, y: H, vx: 1, vy: 0 },
      { x: 0, y: 0, vx: 0, vy: 1 },
    ];
    const distTo = (l: Line, p: { x: number; y: number }) => Math.abs((p.x - l.x) * l.vy - (p.y - l.y) * l.vx);

    // Sides in order: top, right, bottom, left.
    const sides: (Line | null)[] = pts.map((a, i) => {
      const b = pts[(i + 1) % 4];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const nx = -uy;
      const ny = ux;
      const strong: number[] = [];
      for (let s = 0; s < REFINE_SAMPLES; s++) {
        const t = 0.06 + (0.88 * s) / (REFINE_SAMPLES - 1);
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        let best = 0;
        let bestO = 0;
        for (let o = -reach; o <= reach; o += 1) {
          let inner = 0;
          let outer = 0;
          for (let d = STEP_NEAR; d <= STEP_FAR; d++) {
            inner += at(px + nx * (o - d), py + ny * (o - d));
            outer += at(px + nx * (o + d), py + ny * (o + d));
          }
          const step = Math.abs(outer - inner) / (STEP_FAR - STEP_NEAR + 1);
          if (step > best) {
            best = step;
            bestO = o;
          }
        }
        if (best >= REFINE_MIN_STEP) strong.push(px + nx * bestO, py + ny * bestO);
      }
      if (strong.length / 2 >= REFINE_SAMPLES * 0.4) {
        const m = keep(cv.matFromArray(strong.length / 2, 1, cv.CV_32FC2, strong));
        const fit = keep(new cv.Mat());
        cv.fitLine(m, fit, cv.DIST_HUBER, 0, 0.01, 0.01);
        const [vx, vy, x0, y0] = fit.data32F as Float32Array;
        const line = { x: x0, y: y0, vx, vy };
        // Same direction as the rough side (within ~5°), and close to it.
        const parallel = Math.abs(ux * vy - uy * vx) <= Math.sin((5 * Math.PI) / 180);
        if (parallel && distTo(line, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) <= reach) return line;
      }
      // No paper edge along this side: fine only if the page runs off the photo here.
      const border = BORDERS.find((l) => distTo(l, a) <= reach * 1.5 && distTo(l, b) <= reach * 1.5);
      return border ?? null;
    });
    if (sides.some((l) => !l)) return "rejected";

    const lines = sides as Line[];
    const meet = (p: Line, q: Line) => {
      const den = p.vx * q.vy - p.vy * q.vx;
      if (Math.abs(den) < 1e-6) return null;
      const t = ((q.x - p.x) * q.vy - (q.y - p.y) * q.vx) / den;
      return { x: p.x + p.vx * t, y: p.y + p.vy * t };
    };
    // Corner i sits where side i-1 meets side i (top-left = left ∩ top, ...).
    const out = [0, 1, 2, 3].map((i) => meet(lines[(i + 3) % 4], lines[i]));
    if (out.some((p, i) => !p || Math.hypot(p.x - pts[i].x, p.y - pts[i].y) > reach * 2)) return "rejected";
    const c = (out as { x: number; y: number }[]).map((p) => ({
      x: Math.min(Math.max(p.x / k, 0), photo.width),
      y: Math.min(Math.max(p.y / k, 0), photo.height),
    }));
    return { topLeft: c[0], topRight: c[1], bottomRight: c[2], bottomLeft: c[3] };
  } catch (e) {
    console.warn("edge refinement failed; keeping the rough corners", e);
    return null;
  } finally {
    mats.forEach((m) => m.delete());
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
        page = trimmed(r.output, EDGE_TRIM);
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

/** Cut `share` of the width/height off every side. */
function trimmed(src: HTMLCanvasElement, share: number): HTMLCanvasElement {
  const dx = Math.round(src.width * share);
  const dy = Math.round(src.height * share);
  const c = document.createElement("canvas");
  c.width = src.width - 2 * dx;
  c.height = src.height - 2 * dy;
  (c.getContext("2d") as CanvasRenderingContext2D).drawImage(src, dx, dy, c.width, c.height, 0, 0, c.width, c.height);
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
