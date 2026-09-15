import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  ensureContrast,
  hueDistance,
  oklchToHex,
  oklchToRgb,
  readableOn,
  rgbToHex,
  rgbToOklch,
  type OKLCH,
  type RGB,
} from "./color";

/**
 * Album-cover → page theme.
 *
 * Runs on the server at build time (pages are statically generated), so the
 * cost is paid once per release, never in the browser. The pipeline:
 *
 *   1. load the cover (local file under /public or a remote URL)
 *   2. downsample to ≤64px with sharp and read raw RGB pixels
 *   3. median-cut quantize into 8 colour boxes (deterministic → stable builds)
 *   4. score boxes for "dominant" (population) and "vibrant" (chroma)
 *   5. derive bg / fg / accents in OKLCH and enforce WCAG contrast
 *   6. also emit a 16px blur placeholder for next/image
 *
 * Any failure (missing file, corrupt image, network) resolves to the brand
 * fallback palette so a broken cover can never break a page.
 */

export interface Palette {
  mode: "dark" | "light";
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  /** Text colour to use on top of `accent`. */
  accentFg: string;
  accent2: string;
  accent3: string;
  /** Raw quantized colours, most → least common. */
  swatches: string[];
  source: "extracted" | "fallback";
}

export interface CoverMeta {
  width: number;
  height: number;
  blurDataURL?: string;
}

export interface CoverTheme {
  palette: Palette;
  cover: CoverMeta;
}

export const FALLBACK_PALETTE: Palette = {
  mode: "dark",
  bg: "#0a0a0a",
  fg: "#f2f2ea",
  muted: "#a8a89f",
  accent: "#c6ff00",
  accentFg: "#000000",
  accent2: "#ff2e88",
  accent3: "#4d5bff",
  swatches: ["#0a0a0a", "#c6ff00", "#ff2e88", "#4d5bff"],
  source: "fallback",
};

const FALLBACK_COVER: CoverMeta = { width: 1400, height: 1400 };

const PUBLIC_DIR = path.join(process.cwd(), "public");
const SAMPLE_SIZE = 64;
const BOX_COUNT = 8;
const FETCH_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Loading

async function loadCoverBuffer(src: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
    return Buffer.from(await res.arrayBuffer());
  }
  // Local asset under /public. Resolve + guard against path traversal.
  const resolved = path.resolve(PUBLIC_DIR, "." + path.posix.normalize("/" + src));
  if (!resolved.startsWith(PUBLIC_DIR)) throw new Error(`Refusing to read outside /public: ${src}`);
  return readFile(resolved);
}

// ---------------------------------------------------------------------------
// Quantization (median cut)

interface Box {
  start: number;
  /** Exclusive; indexes into `order`. */
  end: number;
}

interface Swatch {
  rgb: RGB;
  lch: OKLCH;
  /** 0–1 share of sampled pixels. */
  share: number;
}

function medianCut(pixels: Uint8Array, channels: number, boxCount: number): Swatch[] {
  const count = Math.floor(pixels.length / channels);
  if (count === 0) return [];

  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;

  const channelRange = (box: Box) => {
    const min = [255, 255, 255];
    const max = [0, 0, 0];
    for (let i = box.start; i < box.end; i++) {
      const p = order[i] * channels;
      for (let ch = 0; ch < 3; ch++) {
        const v = pixels[p + ch];
        if (v < min[ch]) min[ch] = v;
        if (v > max[ch]) max[ch] = v;
      }
    }
    // Weight green a little higher: the eye is most sensitive there.
    const weighted = [(max[0] - min[0]) * 1.0, (max[1] - min[1]) * 1.2, (max[2] - min[2]) * 0.8];
    let widest = 0;
    for (let ch = 1; ch < 3; ch++) if (weighted[ch] > weighted[widest]) widest = ch;
    return { widest, spread: weighted[widest] };
  };

  const boxes: Box[] = [{ start: 0, end: count }];

  while (boxes.length < boxCount) {
    let pick = -1;
    let pickSpread = -1;
    let pickChannel = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.end - box.start < 2) continue;
      const { widest, spread } = channelRange(box);
      if (spread > pickSpread) {
        pickSpread = spread;
        pick = i;
        pickChannel = widest;
      }
    }
    if (pick === -1 || pickSpread === 0) break;

    const box = boxes[pick];
    const slice = order.subarray(box.start, box.end);
    const ch = pickChannel;
    slice.sort((a, b) => pixels[a * channels + ch] - pixels[b * channels + ch]);
    const mid = box.start + Math.floor((box.end - box.start) / 2);
    boxes.splice(pick, 1, { start: box.start, end: mid }, { start: mid, end: box.end });
  }

  // Median cut yields boxes of roughly *equal* population by construction, so
  // its counts say nothing about dominance. Use the box means as seeds and run
  // a few Lloyd iterations to get true centroids and real pixel shares.
  const centroids: number[][] = boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    const n = box.end - box.start;
    for (let i = box.start; i < box.end; i++) {
      const p = order[i] * channels;
      r += pixels[p];
      g += pixels[p + 1];
      b += pixels[p + 2];
    }
    return [r / n, g / n, b / n];
  });

  const k = centroids.length;
  const sums = new Float64Array(k * 3);
  const counts = new Uint32Array(k);
  for (let iter = 0; iter < 4; iter++) {
    sums.fill(0);
    counts.fill(0);
    for (let i = 0; i < count; i++) {
      const p = i * channels;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = r - centroids[c][0];
        const dg = g - centroids[c][1];
        const db = b - centroids[c][2];
        const d = dr * dr + dg * dg * 1.4 + db * db * 0.8;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      sums[best * 3] += r;
      sums[best * 3 + 1] += g;
      sums[best * 3 + 2] += b;
      counts[best]++;
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue;
      centroids[c] = [sums[c * 3] / counts[c], sums[c * 3 + 1] / counts[c], sums[c * 3 + 2] / counts[c]];
    }
  }

  const swatches = centroids
    .map((c, i) => {
      const rgb: RGB = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
      return { rgb, lch: rgbToOklch(rgb), share: counts[i] / count };
    })
    .filter((s) => s.share > 0)
    .sort((a, b) => b.share - a.share);

  return mergeSimilar(swatches);
}

/**
 * Grain, gradients and anti-aliasing split one perceptual colour across
 * several clusters, which makes a fragmented background lose the "dominant"
 * vote to a solid shape. Merge clusters closer than a small OKLab distance.
 */
function mergeSimilar(swatches: Swatch[], threshold = 0.06): Swatch[] {
  const merged: Array<Swatch & { lab: { L: number; a: number; b: number } }> = [];
  const toLab = (s: Swatch) => {
    const h = (s.lch.h * Math.PI) / 180;
    return { L: s.lch.l, a: s.lch.c * Math.cos(h), b: s.lch.c * Math.sin(h) };
  };
  for (const s of swatches) {
    const lab = toLab(s);
    const near = merged.find((m) => Math.hypot(m.lab.L - lab.L, m.lab.a - lab.a, m.lab.b - lab.b) < threshold);
    if (near) {
      const total = near.share + s.share;
      near.rgb = [0, 1, 2].map((i) => Math.round((near.rgb[i] * near.share + s.rgb[i] * s.share) / total)) as unknown as RGB;
      near.share = total;
      near.lch = rgbToOklch(near.rgb);
      near.lab = toLab(near);
    } else {
      merged.push({ ...s, lab });
    }
  }
  return merged
    .map((m) => ({ rgb: m.rgb, lch: m.lch, share: m.share }))
    .sort((a, b) => b.share - a.share);
}

// ---------------------------------------------------------------------------
// Palette derivation

/** Deterministic 0–360 hue from a string, used when artwork is grayscale. */
function seedHue(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

function derivePalette(swatches: Swatch[], seed: string): Palette {
  if (swatches.length === 0) throw new Error("No pixels sampled");

  const dominant = swatches[0];
  const meanL = swatches.reduce((acc, s) => acc + s.lch.l * s.share, 0);
  const mode: Palette["mode"] = meanL > 0.62 ? "light" : "dark";

  // "Vibrant" = chroma-heavy, mid-lightness colours, weighted by population so
  // a single saturated pixel cluster doesn't hijack the theme.
  const candidates = swatches
    .filter((s) => s.lch.c >= 0.06 && s.lch.l >= 0.2 && s.lch.l <= 0.92)
    .map((s) => ({ s, score: s.lch.c * (0.35 + s.share) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);

  const grayscale = candidates.length === 0;
  const fallbackHue = seedHue(seed);

  const vibrant: OKLCH = grayscale
    ? { l: 0.7, c: 0.24, h: fallbackHue }
    : { ...candidates[0].lch, c: Math.max(candidates[0].lch.c, 0.14) };

  // Secondary accents must cover a real slice of the artwork; tiny clusters are
  // usually anti-aliasing between two other colours and read as mud.
  const pickDistinct = (used: OKLCH[], minDist: number, rotate: number): OKLCH => {
    const found = candidates.find((s) => s.share >= 0.025 && used.every((u) => hueDistance(u.h, s.lch.h) >= minDist));
    if (found) return { ...found.lch, c: Math.max(found.lch.c, 0.13) };
    // Nothing distinct in the art: synthesize a punchy hue rotation.
    return { l: 0.72, c: 0.22, h: (used[0].h + rotate) % 360 };
  };
  const second = pickDistinct([vibrant], 45, 180);
  const third = pickDistinct([vibrant, second], 40, 300);

  // Base hue for surfaces: the dominant colour if it has any colour in it,
  // otherwise borrow the vibrant hue so gray covers still get a tinted page.
  // Even a faint tint (cream, off-white, warm gray) is worth keeping; only
  // true neutrals borrow the vibrant hue.
  const tinted = dominant.lch.c > 0.015;
  const surfaceHue = tinted ? dominant.lch.h : vibrant.h;
  const surfaceChroma = tinted ? dominant.lch.c : 0.04;

  let bg: OKLCH;
  let fg: OKLCH;
  let muted: OKLCH;
  let accent: OKLCH;
  let accent2: OKLCH;
  let accent3: OKLCH;

  if (mode === "dark") {
    bg = {
      l: Math.min(0.26, Math.max(0.11, dominant.lch.l * 0.55)),
      c: Math.min(surfaceChroma, 0.11),
      h: surfaceHue,
    };
    const bgRgb = oklchToRgb(bg);
    fg = ensureContrast({ l: 0.97, c: Math.min(surfaceChroma, 0.02), h: surfaceHue }, bgRgb, 7, "lighter");
    muted = ensureContrast({ l: 0.74, c: 0.03, h: surfaceHue }, bgRgb, 4.5, "lighter");
    // Keep bright accents bright — on a dark surface the punch is the point.
    accent = ensureContrast({ ...vibrant, l: Math.min(0.95, Math.max(0.7, vibrant.l)) }, bgRgb, 3, "lighter");
    accent2 = ensureContrast({ ...second, l: Math.min(0.92, Math.max(0.66, second.l)) }, bgRgb, 3, "lighter");
    accent3 = ensureContrast({ ...third, l: Math.min(0.92, Math.max(0.6, third.l)) }, bgRgb, 2.5, "lighter");
  } else {
    bg = {
      l: Math.min(0.96, Math.max(0.9, dominant.lch.l)),
      c: Math.min(surfaceChroma, 0.05),
      h: surfaceHue,
    };
    const bgRgb = oklchToRgb(bg);
    fg = ensureContrast({ l: 0.2, c: Math.min(surfaceChroma, 0.06), h: surfaceHue }, bgRgb, 7, "darker");
    muted = ensureContrast({ l: 0.45, c: 0.04, h: surfaceHue }, bgRgb, 4.5, "darker");
    accent = ensureContrast({ ...vibrant, l: Math.min(0.62, Math.max(0.45, vibrant.l)) }, bgRgb, 3, "darker");
    accent2 = ensureContrast({ ...second, l: Math.min(0.62, Math.max(0.42, second.l)) }, bgRgb, 3, "darker");
    accent3 = ensureContrast({ ...third, l: Math.min(0.66, Math.max(0.45, third.l)) }, bgRgb, 2.5, "darker");
  }

  const accentRgb = oklchToRgb(accent);

  return {
    mode,
    bg: oklchToHex(bg),
    fg: oklchToHex(fg),
    muted: oklchToHex(muted),
    accent: rgbToHex(accentRgb),
    accentFg: readableOn(accentRgb),
    accent2: oklchToHex(accent2),
    accent3: oklchToHex(accent3),
    swatches: swatches.map((s) => rgbToHex(s.rgb)),
    source: "extracted",
  };
}

// ---------------------------------------------------------------------------
// Public API

async function extract(src: string, seed: string): Promise<CoverTheme> {
  const buffer = await loadCoverBuffer(src);
  const image = sharp(buffer, { failOn: "none", limitInputPixels: 64_000_000 }).rotate();
  const metadata = await image.metadata();

  const [sample, blur] = await Promise.all([
    image
      .clone()
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside", kernel: "lanczos3" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    image
      .clone()
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 40, alphaQuality: 20 })
      .toBuffer()
      .then((b) => `data:image/webp;base64,${b.toString("base64")}`)
      .catch(() => undefined),
  ]);

  const pixels = new Uint8Array(sample.data.buffer, sample.data.byteOffset, sample.data.length);
  const swatches = medianCut(pixels, sample.info.channels, BOX_COUNT);
  const palette = derivePalette(swatches, seed);

  const width = metadata.width ?? FALLBACK_COVER.width;
  const height = metadata.height ?? FALLBACK_COVER.height;
  // EXIF orientation 5–8 swap the axes; sharp's .rotate() already applied it.
  const swapped = (metadata.orientation ?? 1) >= 5;

  return {
    palette,
    cover: { width: swapped ? height : width, height: swapped ? width : height, blurDataURL: blur },
  };
}

// Module-level memo survives across pages in the same build worker; React's
// cache() dedupes within a single render pass.
const memo = new Map<string, Promise<CoverTheme>>();

/**
 * Get the theme for a cover image. Never throws.
 * @param src   "/covers/x.jpg" (under /public) or an absolute https URL
 * @param seed  stable string (release slug) used for synthetic hues on gray art
 */
export const getCoverTheme = cache(async (src: string | undefined, seed: string): Promise<CoverTheme> => {
  if (!src) return { palette: FALLBACK_PALETTE, cover: FALLBACK_COVER };
  const key = `${src}::${seed}`;
  let pending = memo.get(key);
  if (!pending) {
    pending = extract(src, seed).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[palette] Falling back to brand palette for "${src}": ${message}`);
      memo.delete(key); // allow a retry on the next request (e.g. after ISR)
      return { palette: FALLBACK_PALETTE, cover: FALLBACK_COVER };
    });
    memo.set(key, pending);
  }
  return pending;
});

/**
 * A resized JPEG data URL of the cover for use in OG image generation.
 * Returns undefined on any failure so the OG route can render text-only.
 */
export const getCoverDataUrl = cache(async (src: string | undefined, size = 640): Promise<string | undefined> => {
  if (!src) return undefined;
  try {
    const buffer = await loadCoverBuffer(src);
    const out = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(size, size, { fit: "cover" })
      .flatten({ background: "#000000" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch (err) {
    console.warn(`[palette] Could not prepare OG cover for "${src}":`, err instanceof Error ? err.message : err);
    return undefined;
  }
});
