"use client";

// Client-side page processing: honour EXIF rotation, crop to the paper's edges
// (PRD §5 "edges cropped automatically"), and downscale/compress so a page is
// a few hundred KB — small enough to queue offline and upload on weak signal,
// still sharp enough for handwriting.

const MAX_EDGE = 2200;
const QUALITY = 0.82;

export interface ProcessedPage {
  blob: Blob;
  width: number;
  height: number;
  cropped: boolean;
  /** Uncropped version, kept on the device so staff can undo a bad auto-crop. */
  original?: { blob: Blob; width: number; height: number };
}

export async function processPhoto(source: Blob, opts: { autoCrop: boolean }): Promise<ProcessedPage> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const box = opts.autoCrop ? detectPaper(bitmap) : null;
    const full = await render(bitmap, { x: 0, y: 0, w: bitmap.width, h: bitmap.height });
    if (!box) return { ...full, cropped: false };
    const cropped = await render(bitmap, box);
    return { ...cropped, cropped: true, original: full };
  } finally {
    bitmap.close();
  }
}

async function render(bitmap: ImageBitmap, b: { x: number; y: number; w: number; h: number }) {
  const scale = Math.min(1, MAX_EDGE / Math.max(b.w, b.h));
  const w = Math.round(b.w * scale);
  const h = Math.round(b.h * scale);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, b.x, b.y, b.w, b.h, 0, 0, w, h);
  return { blob: await toJpeg(canvas), width: w, height: h };
}

export async function processVideoFrame(video: HTMLVideoElement, opts: { autoCrop: boolean }): Promise<ProcessedPage> {
  const c = makeCanvas(video.videoWidth, video.videoHeight);
  (c.getContext("2d") as CanvasRenderingContext2D).drawImage(video, 0, 0);
  return processPhoto(await toJpeg(c, 0.95), opts);
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toJpeg(canvas: HTMLCanvasElement, q = QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode image"))), "image/jpeg", q),
  );
}

/**
 * Find the sheet of paper: paper is the large bright region against a darker
 * table/cloth. Works on a 256px thumbnail with an Otsu threshold and row/column
 * projections. Returns null (keep the full photo) when unsure — a missed crop
 * costs nothing, a wrong crop could cut off a signature or mobile number.
 */
function detectPaper(bitmap: ImageBitmap): { x: number; y: number; w: number; h: number } | null {
  const S = 256;
  const k = S / Math.max(bitmap.width, bitmap.height);
  const tw = Math.max(16, Math.round(bitmap.width * k));
  const th = Math.max(16, Math.round(bitmap.height * k));
  const c = makeCanvas(tw, th);
  const ctx = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);

  const lum = new Uint8Array(tw * th);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < tw * th; i++) {
    const v = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
    lum[i] = v;
    hist[lum[i]]++;
  }

  // Otsu threshold
  const total = tw * th;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thresh = 128, mB = 0, mF = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mb = sumB / wB;
    const mf = (sum - sumB) / wF;
    const between = wB * wF * (mb - mf) ** 2;
    if (between > best) {
      best = between;
      thresh = t;
      mB = mb;
      mF = mf;
    }
  }
  if (mF - mB < 45) return null; // not enough contrast between paper and background

  const rowFrac = new Float32Array(th);
  for (let y = 0; y < th; y++) {
    let n = 0;
    for (let x = 0; x < tw; x++) if (lum[y * tw + x] > thresh) n++;
    rowFrac[y] = n / tw;
  }
  const span = outerSpan(rowFrac, 0.3);
  if (!span) return null;
  let [top, bottom] = span;

  const colFrac = new Float32Array(tw);
  const rh = bottom - top + 1;
  for (let x = 0; x < tw; x++) {
    let n = 0;
    for (let y = top; y <= bottom; y++) if (lum[y * tw + x] > thresh) n++;
    colFrac[x] = n / rh;
  }
  const cspan = outerSpan(colFrac, 0.3);
  if (!cspan) return null;
  let [left, right] = cspan;

  // Trim a side only where there is a real paper edge: a sharp brightness step
  // from a darker background strip to the paper. Uneven light (a phone's shadow,
  // a screen photographed at an angle) dims the paper gradually and has no step,
  // so that side is left alone. Getting this wrong cut off the signature and
  // mobile number at the bottom of a letter.
  const mean = (x0: number, x1: number, y0: number, y1: number) => {
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(tw - 1, x1); y1 = Math.min(th - 1, y1);
    if (x1 < x0 || y1 < y0) return NaN;
    let s = 0, n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { s += lum[y * tw + x]; n++; }
    return s / n;
  };
  const paper = mean(left, right, top, bottom);
  const kv = Math.max(2, Math.round(th * 0.03));
  const kh = Math.max(2, Math.round(tw * 0.03));
  const isEdge = (inside: number, outside: number, strip: number) =>
    !Number.isNaN(outside) && inside - outside > 40 && strip < paper * 0.65;

  if (top > 0 && !isEdge(mean(left, right, top, top + kv - 1), mean(left, right, top - kv, top - 1), mean(left, right, 0, top - 1))) top = 0;
  if (bottom < th - 1 && !isEdge(mean(left, right, bottom - kv + 1, bottom), mean(left, right, bottom + 1, bottom + kv), mean(left, right, bottom + 1, th - 1))) bottom = th - 1;
  if (left > 0 && !isEdge(mean(left, left + kh - 1, top, bottom), mean(left - kh, left - 1, top, bottom), mean(0, left - 1, top, bottom))) left = 0;
  if (right < tw - 1 && !isEdge(mean(right - kh + 1, right, top, bottom), mean(right + 1, right + kh, top, bottom), mean(right + 1, tw - 1, top, bottom))) right = tw - 1;

  const area = ((right - left + 1) * (bottom - top + 1)) / total;
  if (area < 0.2 || area > 0.92) return null; // nothing worth cropping, or implausible

  const m = 0.015; // margin so edge text is never cut
  const x0 = Math.max(0, left / tw - m);
  const x1 = Math.min(1, (right + 1) / tw + m);
  const y0 = Math.max(0, top / th - m);
  const y1 = Math.min(1, (bottom + 1) / th + m);
  return {
    x: Math.round(x0 * bitmap.width),
    y: Math.round(y0 * bitmap.height),
    w: Math.round((x1 - x0) * bitmap.width),
    h: Math.round((y1 - y0) * bitmap.height),
  };
}

function outerSpan(arr: Float32Array, min: number): [number, number] | null {
  let first = -1;
  let last = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] >= min) {
      if (first < 0) first = i;
      last = i;
    }
  }
  return first >= 0 && last - first >= arr.length * 0.25 ? [first, last] : null;
}
