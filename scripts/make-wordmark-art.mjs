#!/usr/bin/env node
/**
 * Merch artwork: the ojinyx wordmark as line art, one variant per record,
 * with the outline stroked in a gradient pulled from that record's cover.
 *
 *   merch-art/wordmark-<slug>.svg   vector, transparent, infinitely scalable
 *   merch-art/wordmark-<slug>.png   transparent raster at --width (default 8000)
 *   merch-art/preview.png           all variants on dark and light backgrounds
 *
 * Colors are sampled from public/covers/<slug>.<hash>.jpg, so a new record
 * picks itself up as soon as `npm run covers` has produced its poster.
 *
 * Run: npm run merch-art  [-- --width 12000]
 *
 * Print notes: SVG is the master — give that to a printer. Hue and chroma are
 * taken from the artwork, but lightness is lifted into a mid-to-bright band so
 * the line reads on black garments as well as white. Screen printing a gradient
 * needs simulated process or DTG/DTF; for single-color prints, recolor the
 * stroke to one flat value.
 */
import sharp from "sharp";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const COVERS = path.join(root, "public", "covers");
const OUT = path.join(root, "merch-art");

const args = process.argv.slice(2);
const widthArg = Number(args[args.indexOf("--width") + 1]);
const TARGET_WIDTH = Number.isFinite(widthArg) && widthArg > 0 ? widthArg : 10000;
const STROKE = 1.6; // in viewBox units; ~27px once rendered at 10000 wide

// ---------------------------------------------------------------------------
// OKLab / OKLCH (Björn Ottosson). Kept inline so this script stays standalone.

const srgbToLinear = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
const linearToSrgb = (v) => {
  const c = Math.min(1, Math.max(0, v));
  return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
};

function rgbToOklch(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: Math.hypot(A, B), h };
}

function oklchToLinearRgb(l, c, h) {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.001 && v <= 1.001);

function oklchToHex({ l, c, h }) {
  for (let chroma = Math.max(0, c), i = 0; i < 30; i++, chroma *= 0.92) {
    const rgb = oklchToLinearRgb(l, chroma, h);
    if (inGamut(rgb)) return "#" + rgb.map((v) => linearToSrgb(v).toString(16).padStart(2, "0")).join("");
  }
  return "#ffffff";
}

/** Largest chroma that still fits in sRGB at this lightness and hue. */
function maxChroma(l, h) {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinearRgb(l, mid, h))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * The most saturated version of a hue that sRGB can actually print, kept
 * bright enough to read on a black garment. Yellows peak light, blues peak
 * dark, which is what gives each record its own character.
 */
function vivid(h) {
  let best = { l: 0.7, c: 0 };
  for (let l = 0.42; l <= 0.9; l += 0.01) {
    const c = maxChroma(l, h);
    if (c > best.c) best = { l, c };
  }
  const l = Math.min(0.88, Math.max(0.52, best.l));
  return { l, c: maxChroma(l, h) * 0.96, h };
}

const hueGap = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};

// ---------------------------------------------------------------------------
// Pull gradient stops out of a cover

async function gradientStops(file, stopCount = 3) {
  const { data, info } = await sharp(file).resize(128, 128, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

  // Bin by hue, weighting saturated pixels far more than washed-out ones.
  const BINS = 24;
  const bins = Array.from({ length: BINS }, () => ({ weight: 0, l: 0, c: 0, x: 0, y: 0, n: 0 }));
  for (let i = 0; i < data.length; i += info.channels) {
    const { l, c, h } = rgbToOklch(data[i], data[i + 1], data[i + 2]);
    if (l < 0.12 || l > 0.96) continue; // near-black and near-white carry no hue
    const bin = bins[Math.floor(h / (360 / BINS)) % BINS];
    const w = Math.pow(c, 1.5);
    bin.weight += w;
    bin.l += l * w;
    bin.c += c * w;
    bin.x += Math.cos((h * Math.PI) / 180) * w;
    bin.y += Math.sin((h * Math.PI) / 180) * w;
    bin.n++;
  }

  const candidates = bins
    .filter((b) => b.weight > 0 && b.n > 40)
    .map((b) => {
      let h = (Math.atan2(b.y, b.x) * 180) / Math.PI;
      if (h < 0) h += 360;
      return { weight: b.weight, l: b.l / b.weight, c: b.c / b.weight, h };
    })
    .sort((a, b) => b.weight - a.weight);

  // Greedily take the strongest hues that are distinct from each other. A hue
  // has to carry real weight to earn a stop, otherwise a stray highlight ends
  // up defining a third of the gradient.
  const picked = [];
  const floor = (candidates[0]?.weight ?? 0) * 0.12;
  for (const cand of candidates) {
    if (picked.length >= stopCount) break;
    if (cand.weight < floor) break;
    if (picked.every((p) => hueGap(p.h, cand.h) >= 40)) picked.push(cand);
  }

  // Near-monochrome artwork: fan the dominant hue out so there is still a sweep.
  if (picked.length < stopCount) {
    const base = picked[0] ?? candidates[0] ?? { l: 0.7, c: 0.16, h: 285 };
    const spread = picked.length === 0 ? 30 : 34;
    while (picked.length < stopCount) {
      picked.push({ ...base, h: (base.h + picked.length * spread + 360) % 360, weight: 0 });
    }
  }

  // Render each hue at its most vivid rather than forcing a lightness ramp —
  // a ramp washed every record out to the same pale lilac at the top end.
  picked.sort((a, b) => a.h - b.h);
  return picked.map((p) => oklchToHex(vivid(p.h)));
}

// ---------------------------------------------------------------------------
// SVG

function buildSvg({ id, viewBox, pathData, stops, width, height, includeSize }) {
  const [minX, minY, vbW, vbH] = viewBox.split(/\s+/).map(Number);
  const pad = STROKE * 2;
  const box = [minX - pad, minY - pad, vbW + pad * 2, vbH + pad * 2].join(" ");
  const size = includeSize ? ` width="${width}" height="${height}"` : "";
  const offsets = stops.map((_, i) => (stops.length === 1 ? 0 : (i / (stops.length - 1)) * 100));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"${size} role="img" aria-label="ojinyx">
  <title>ojinyx — ${id}</title>
  <defs>
    <linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1">
${stops.map((s, i) => `      <stop offset="${offsets[i].toFixed(1)}%" stop-color="${s}"/>`).join("\n")}
    </linearGradient>
  </defs>
  <path d="${pathData}" fill="none" stroke="url(#g-${id})" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`;
}

// ---------------------------------------------------------------------------

const wordmarkSvg = await readFile(path.join(root, "public", "brand", "wordmark.svg"), "utf8");
const pathData = /<path[^>]*\sd="([^"]+)"/.exec(wordmarkSvg)?.[1];
const viewBox = /viewBox="([^"]+)"/.exec(wordmarkSvg)?.[1];
if (!pathData || !viewBox) {
  console.error("Could not read the wordmark path from public/brand/wordmark.svg");
  process.exit(1);
}

// Display names, read straight out of the content file so they stay in sync.
const releasesSrc = await readFile(path.join(root, "src", "content", "releases.ts"), "utf8");
const titles = new Map();
for (const m of releasesSrc.matchAll(/slug:\s*"([^"]+)",\s*\n\s*title:\s*"([^"]+)"/g)) titles.set(m[1], m[2]);

const posters = (await readdir(COVERS)).filter((f) => f.endsWith(".jpg")).sort();
if (posters.length === 0) {
  console.error("No posters in public/covers — run `npm run covers` first.");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);
const pad = STROKE * 2;
const aspect = (vbW + pad * 2) / (vbH + pad * 2);
const outHeight = Math.round(TARGET_WIDTH / aspect);

const made = [];
for (const file of posters) {
  const slug = file.split(".")[0];
  const stops = await gradientStops(path.join(COVERS, file));
  const name = titles.get(slug) ?? slug.toUpperCase();

  const svg = buildSvg({ id: slug, viewBox, pathData, stops, width: TARGET_WIDTH, height: outHeight, includeSize: false });
  await writeFile(path.join(OUT, `wordmark-${slug}.svg`), svg);

  // Rasterize above the target (sharp scales SVG px by density/72) and resize
  // down, so curved strokes get supersampled and the width is exactly asked for.
  const rasterSvg = buildSvg({ id: slug, viewBox, pathData, stops, width: TARGET_WIDTH, height: outHeight, includeSize: true });
  const png = await sharp(Buffer.from(rasterSvg), { density: 96, limitInputPixels: false })
    .resize({ width: TARGET_WIDTH, height: outHeight, fit: "fill", kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(OUT, `wordmark-${slug}.png`), png);

  made.push({ slug, name, stops, png });
  console.log(`- ${name.padEnd(14)} ${stops.join(" → ")}   ${TARGET_WIDTH}×${outHeight}  ${(png.length / 1024 / 1024).toFixed(1)} MB`);
}

// Contact sheet: every variant on black and on white, to check both garments.
const tileW = 1100;
const tileH = Math.round(tileW / aspect);
const rows = await Promise.all(
  made.map(async (m) => sharp(m.png).resize(tileW, tileH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()),
);
const gap = 26;
const sheetW = tileW * 2 + gap * 3;
const sheetH = (tileH + gap) * made.length + gap;
await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 10, g: 4, b: 16, alpha: 1 } } })
  .composite([
    { input: { create: { width: tileW + gap, height: sheetH, channels: 4, background: { r: 245, g: 243, b: 247, alpha: 1 } } }, left: tileW + gap * 2 - gap / 2, top: 0 },
    ...rows.flatMap((buf, i) => [
      { input: buf, left: gap, top: gap + i * (tileH + gap) },
      { input: buf, left: tileW + gap * 2, top: gap + i * (tileH + gap) },
    ]),
  ])
  .png()
  .toFile(path.join(OUT, "preview.png"));

console.log(`\nwrote ${made.length * 2 + 1} files to ${path.relative(root, OUT)}/ (SVG is the print master)`);
