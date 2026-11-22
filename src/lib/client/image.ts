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
}

export async function processPhoto(source: Blob, opts: { autoCrop: boolean }): Promise<ProcessedPage> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const box = opts.autoCrop ? detectPaper(bitmap) : null;
    const sx = box?.x ?? 0;
    const sy = box?.y ?? 0;
    const sw = box?.w ?? bitmap.width;
    const sh = box?.h ?? bitmap.height;
    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const canvas = makeCanvas(w, h);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
    const blob = await toJpeg(canvas);
    return { blob, width: w, height: h, cropped: !!box };
  } finally {
    bitmap.close();
  }
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
  const rows = outerSpan(rowFrac, 0.3);
  if (!rows) return null;

  const colFrac = new Float32Array(tw);
  const rh = rows[1] - rows[0] + 1;
  for (let x = 0; x < tw; x++) {
    let n = 0;
    for (let y = rows[0]; y <= rows[1]; y++) if (lum[y * tw + x] > thresh) n++;
    colFrac[x] = n / rh;
  }
  const cols = outerSpan(colFrac, 0.3);
  if (!cols) return null;

  const area = ((cols[1] - cols[0] + 1) * rh) / total;
  if (area < 0.2 || area > 0.92) return null; // nothing to crop, or implausible

  const m = 0.015; // margin so edge text is never cut
  const x0 = Math.max(0, cols[0] / tw - m);
  const x1 = Math.min(1, (cols[1] + 1) / tw + m);
  const y0 = Math.max(0, rows[0] / th - m);
  const y1 = Math.min(1, (rows[1] + 1) / th + m);
  return {
    x: Math.round(x0 * bitmap.width),
    y: Math.round(y0 * bitmap.height),
    w: Math.round((x1 - x0) * bitmap.width),
    h: Math.round((y1 - y0) * bitmap.height),
  };
}

/**
 * First..last index at or above `min`. Deliberately the OUTER span, not the longest
 * contiguous run: dense handwriting darkens whole columns/rows of the sheet, and a
 * run-based search would crop to a blank strip and cut the text off. Anything bright
 * outside the sheet only makes the crop larger, which is the safe direction.
 */
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
