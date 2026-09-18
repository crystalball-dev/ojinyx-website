#!/usr/bin/env node
/**
 * Break the KINGDOMS cover into reusable merch assets.
 *
 *   brand-art/kingdoms-assets/cover-4000.png        the clean full-res still
 *   brand-art/kingdoms-assets/logotype-white.png    KINGDOMS lettering, alpha
 *   brand-art/kingdoms-assets/logotype-black.png    same, for light garments
 *   brand-art/kingdoms-assets/castle-crop.png       tight crop, no matte
 *   brand-art/kingdoms-assets/castle-cutout.png     castle on transparency
 *   brand-art/kingdoms-assets/castle-silhouette.png flat stencil, alpha
 *   brand-art/kingdoms-assets/moon.png              the moon disc, alpha
 *   brand-art/kingdoms-assets/contact-sheet.png     everything, checkered
 *
 * Run: npm run split-cover
 *
 * ── Where the pixels come from ────────────────────────────────────────────
 * There is no still of this cover on disk — only the 1080px web JPEG and the
 * animations. `_MConverter.eu_HA1-Front Cover.mp4` is 4000x4000 at 6.5 Mb/s,
 * so a single frame out of it is the highest-quality source that exists here,
 * and far better than anything upscaled from the 1080 JPEG.
 *
 * ── How the castle is matted ──────────────────────────────────────────────
 * Thresholding fails on this artwork: the castle's tones (luma 29-58) overlap
 * the clouds' (56-89), and its lit faces and windows are brighter than the sky
 * behind them. What IS reliably true is that the castle is darker than
 * whatever sits immediately behind it — it is painted as a silhouette against
 * the moon.
 *
 * So the matte is local rather than global: blur the luminance heavily to
 * estimate the background at each point, then take pixels that are enough
 * darker than that estimate. Bright windows punch holes, which the hole fill
 * closes, and the result is trimmed to the castle's bounding box so clouds
 * elsewhere in the frame cannot join in.
 *
 * ── What this cannot do ───────────────────────────────────────────────────
 * The base of the castle is painted dissolving into fog. There is no edge
 * there to find, because the artist did not paint one. The matte fades out
 * through that zone and the exact cut is a judgement call — hence
 * `castle-crop.png`, which keeps every pixel so the decision stays yours.
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);
const root = process.cwd();
const OUT = path.join(root, "brand-art", "kingdoms-assets");
const SOURCE = path.join(root, "_ANIMATIONS", "KINGDOMS", "_MConverter.eu_HA1-Front Cover.mp4");

/** Full frame edge, in pixels. */
const N = 4000;
/** The mask is computed here and upscaled; full res is needlessly slow for a blur this wide. */
const M = 1000;
const up = N / M;

/**
 * Regions, read off a gridded overview and given in 900-space, which is how
 * they were measured. `s` converts to the 4000px frame.
 */
const s = (v) => Math.round((v / 900) * N);
const REGION = {
  castle: { x0: s(243), y0: s(100), x1: s(678), y1: s(640) },
  logotype: { x0: s(175), y0: s(672), x1: s(748), y1: s(810) },
  moon: { cx: s(445), cy: s(240), r: s(190) },
};

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};
/** How much darker than its surroundings a pixel must be to count as castle. */
const CASTLE_DELTA = arg("delta", 14);
/** Luminance above which a pixel counts as logotype. */
const LOGO_CUT = arg("logo", 168);

await mkdir(OUT, { recursive: true });

// ── Source frame ─────────────────────────────────────────────────────────────
const framePng = path.join(os.tmpdir(), "kingdoms-frame.png");
await run("ffmpeg", ["-nostdin", "-v", "error", "-i", SOURCE, "-vf", "select=eq(n\\,0)", "-vframes", "1", "-y", framePng]);
const cover = await sharp(framePng).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
await writeFile(path.join(OUT, "cover-4000.png"), cover);

/** Rec.709 luminance plane at a given edge length. */
async function luma(size) {
  const { data } = await sharp(cover).resize(size, size, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}

// ── Castle matte ─────────────────────────────────────────────────────────────
const small = await luma(M);
// Background estimate. The blur has to be wider than the castle's thickest
// limb or the middle of a tower reads as its own background.
const { data: bg } = await sharp(cover).resize(M, M, { fit: "fill" }).greyscale().blur(38).raw().toBuffer({ resolveWithObject: true });

/**
 * The castle's profile, in the same 900-space the regions were measured in.
 * A plain rectangle is not enough: a dark cloud crossing the moon is just as
 * dark against its background as a tower is, so anything boxy pulls that cloud
 * in with it. The castle is narrow at the spires and wide at the ramparts, and
 * following that shape drops the cloud without touching the castle.
 */
const CASTLE_SPAN = [
  { y: 100, x0: 350, x1: 585 },
  { y: 300, x0: 350, x1: 585 },
  { y: 385, x0: 290, x1: 650 },
  { y: 425, x0: 243, x1: 678 },
  { y: 640, x0: 243, x1: 678 },
];

/** Linear interpolation across CASTLE_SPAN, in mask-space pixels. */
function span(yMask) {
  const y900 = (yMask * up * 900) / N;
  if (y900 <= CASTLE_SPAN[0].y || y900 >= CASTLE_SPAN.at(-1).y) return null;
  for (let i = 1; i < CASTLE_SPAN.length; i++) {
    const a = CASTLE_SPAN[i - 1];
    const b = CASTLE_SPAN[i];
    if (y900 > b.y) continue;
    const t = (y900 - a.y) / (b.y - a.y);
    return { x0: (s(a.x0 + (b.x0 - a.x0) * t)) / up, x1: (s(a.x1 + (b.x1 - a.x1) * t)) / up };
  }
  return null;
}

const inside = (x, y) => {
  const sp = span(y);
  return sp !== null && x >= sp.x0 && x < sp.x1;
};
const mask = new Uint8Array(M * M);
for (let y = 0; y < M; y++) {
  for (let x = 0; x < M; x++) {
    const i = y * M + x;
    if (!inside(x, y)) continue;
    if (bg[i] - small[i] >= CASTLE_DELTA) mask[i] = 255;
  }
}

/** Keep only the blob the castle's own towers sit in; drop stray cloud specks. */
function largestComponent(src) {
  const seen = new Uint8Array(M * M);
  const out = new Uint8Array(M * M);
  let best = [];
  const stack = [];
  for (let start = 0; start < M * M; start++) {
    if (!src[start] || seen[start]) continue;
    const comp = [];
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop();
      comp.push(p);
      const px = p % M;
      const py = (p / M) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= M || ny >= M) continue;
          const q = ny * M + nx;
          if (src[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  for (const p of best) out[p] = 255;
  return out;
}

/** Fill enclosed gaps (windows, lit faces) by flooding the outside and inverting. */
function fillHoles(src) {
  const outside = new Uint8Array(M * M);
  const stack = [];
  const push = (p) => {
    if (!src[p] && !outside[p]) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < M; x++) {
    push(x);
    push((M - 1) * M + x);
  }
  for (let y = 0; y < M; y++) {
    push(y * M);
    push(y * M + M - 1);
  }
  while (stack.length) {
    const p = stack.pop();
    const px = p % M;
    const py = (p / M) | 0;
    if (px > 0) push(p - 1);
    if (px < M - 1) push(p + 1);
    if (py > 0) push(p - M);
    if (py < M - 1) push(p + M);
  }
  const out = new Uint8Array(M * M);
  for (let p = 0; p < M * M; p++) out[p] = src[p] || !outside[p] ? 255 : 0;
  return out;
}

/**
 * Approximate morphology with sharp: blur then threshold. A low cut grows the
 * shape, a high cut shrinks it back.
 */
async function morph(src, radius, mode) {
  // sharp promotes a single-channel raw input to sRGB through blur/threshold,
  // so without toColourspace the buffer comes back 3x too long and every index
  // downstream is wrong. This cost an afternoon once; leave it in.
  const out = await sharp(Buffer.from(src), { raw: { width: M, height: M, channels: 1 } })
    .blur(radius)
    .threshold(mode === "dilate" ? 40 : 215)
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  return new Uint8Array(out);
}

// Order matters. The castle's bright windows and lit edges cut its silhouette
// into pieces, so picking the largest component first keeps only a fragment —
// it kept the right-hand third on the first attempt. Closing the gaps first
// makes the castle one blob, and the erode afterwards gives back the width the
// dilate added.
let m = await morph(mask, 3, "dilate");
m = largestComponent(m);
m = fillHoles(m);
const castleMaskSmall = await morph(m, 3, "erode");

/** Grow the mask to full size, softening the staircase the upscale would leave. */
const castleAlpha = new Uint8Array(
  await sharp(Buffer.from(castleMaskSmall), { raw: { width: M, height: M, channels: 1 } })
    .resize(N, N, { kernel: "cubic" })
    .blur(2.5)
    .linear(1.6, -60)
    .toColourspace("b-w")
    .raw()
    .toBuffer(),
);

// Below the rock the castle is painted dissolving into fog, and the mask there
// is really cloud that happens to touch it. Rather than end on a hard
// cloud-shaped edge, ramp the alpha out through that zone — which is what the
// artwork does anyway.
const fogTop = s(560);
const fogEnd = s(650);
for (let y = fogTop; y < N; y++) {
  const k = y >= fogEnd ? 0 : 1 - (y - fogTop) / (fogEnd - fogTop);
  const row = y * N;
  for (let x = 0; x < N; x++) castleAlpha[row + x] = Math.round(castleAlpha[row + x] * k);
}

// `cover` is 3-channel, so joinChannel makes it RGBA. ensureAlpha() first would
// add a 5th channel instead of replacing the alpha, and the result decodes blank.
const castleCutout = await sharp(cover)
  .joinChannel(castleAlpha, { raw: { width: N, height: N, channels: 1 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

// Diagnostic: the matte on its own, to judge the edges without the artwork
// underneath confusing the eye.
await writeFile(
  path.join(OUT, "castle-matte.png"),
  await sharp(Buffer.from(castleAlpha), { raw: { width: N, height: N, channels: 1 } }).png({ compressionLevel: 9 }).toBuffer(),
);

const cc = REGION.castle;
const cw = cc.x1 - cc.x0;
const ch = cc.y1 - cc.y0;
await writeFile(
  path.join(OUT, "castle-cutout.png"),
  await sharp(castleCutout).extract({ left: cc.x0, top: cc.y0, width: cw, height: ch }).png({ compressionLevel: 9 }).toBuffer(),
);
await writeFile(
  path.join(OUT, "castle-crop.png"),
  await sharp(cover).extract({ left: cc.x0, top: cc.y0, width: cw, height: ch }).png({ compressionLevel: 9 }).toBuffer(),
);

// Flat stencil: the same matte as solid ink, for single-color printing.
// extract() has to run in its own pass: chained after joinChannel it is applied
// against the input geometry and silently leaves the frame full size.
const silhouetteFull = await sharp({ create: { width: N, height: N, channels: 3, background: "#0b1016" } })
  .joinChannel(castleAlpha, { raw: { width: N, height: N, channels: 1 } })
  .png()
  .toBuffer();
await writeFile(
  path.join(OUT, "castle-silhouette.png"),
  await sharp(silhouetteFull).extract({ left: cc.x0, top: cc.y0, width: cw, height: ch }).png({ compressionLevel: 9 }).toBuffer(),
);

// ── Logotype ─────────────────────────────────────────────────────────────────
// White lettering on dark cloud: the one element on this cover a plain
// luminance cut separates cleanly.
const fullLuma = await luma(N);
const lg = REGION.logotype;
const logoAlpha = new Uint8Array(N * N);
for (let y = lg.y0; y < lg.y1; y++) {
  for (let x = lg.x0; x < lg.x1; x++) {
    const i = y * N + x;
    const v = fullLuma[i];
    // Ramp rather than a hard cut, so the anti-aliased glyph edges survive.
    logoAlpha[i] = v <= LOGO_CUT ? 0 : Math.min(255, Math.round(((v - LOGO_CUT) / (235 - LOGO_CUT)) * 255));
  }
}
const lw = lg.x1 - lg.x0;
const lh = lg.y1 - lg.y0;
const logoBox = { left: lg.x0, top: lg.y0, width: lw, height: lh };

for (const [name, tint] of [
  ["logotype-white.png", { r: 255, g: 255, b: 255 }],
  ["logotype-black.png", { r: 10, g: 14, b: 20 }],
]) {
  const full = await sharp({ create: { width: N, height: N, channels: 3, background: tint } })
    .joinChannel(Buffer.from(logoAlpha), { raw: { width: N, height: N, channels: 1 } })
    .png()
    .toBuffer();
  await writeFile(path.join(OUT, name), await sharp(full).extract(logoBox).png({ compressionLevel: 9 }).toBuffer());
}

// ── Moon ─────────────────────────────────────────────────────────────────────
const { cx, cy, r } = REGION.moon;
const moonMask = `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}">
  <defs><radialGradient id="m" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff"/>
    <stop offset="0.86" stop-color="#fff"/>
    <stop offset="1" stop-color="#000"/>
  </radialGradient></defs>
  <rect width="${N}" height="${N}" fill="url(#m)"/></svg>`;
const moonAlpha = await sharp(Buffer.from(moonMask)).resize(N, N, { fit: "fill" }).greyscale().toColourspace("b-w").raw().toBuffer();
await writeFile(
  path.join(OUT, "moon.png"),
  await sharp(
    await sharp(cover).joinChannel(moonAlpha, { raw: { width: N, height: N, channels: 1 } }).png().toBuffer(),
  )
    .extract({ left: cx - r, top: cy - r, width: r * 2, height: r * 2 })
    .png({ compressionLevel: 9 })
    .toBuffer(),
);

// ── Contact sheet ────────────────────────────────────────────────────────────
// On a checkerboard, so transparency is visible rather than guessed at.
const files = ["cover-4000.png", "castle-crop.png", "castle-cutout.png", "castle-silhouette.png", "logotype-white.png", "moon.png"];
const tile = 560;
const checker = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">
  <defs><pattern id="c" width="40" height="40" patternUnits="userSpaceOnUse">
    <rect width="40" height="40" fill="#5a5a66"/><rect width="20" height="20" fill="#767682"/>
    <rect x="20" y="20" width="20" height="20" fill="#767682"/>
  </pattern></defs><rect width="${tile}" height="${tile}" fill="url(#c)"/></svg>`;
const checkerBuf = await sharp(Buffer.from(checker)).resize(tile, tile, { fit: "fill" }).png().toBuffer();

const cells = [];
for (const f of files) {
  const fitted = await sharp(path.join(OUT, f)).resize(tile - 24, tile - 24, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  cells.push(await sharp(checkerBuf).composite([{ input: fitted, gravity: "center" }]).png().toBuffer());
}
const cols = 3;
const gap = 14;
const labelH = 30;
const rows = Math.ceil(cells.length / cols);
const sheetW = cols * (tile + gap) + gap;
const sheetH = rows * (tile + labelH + gap) + gap;
const labels = files
  .map((f, i) => {
    const x = gap + (i % cols) * (tile + gap);
    const y = gap + Math.floor(i / cols) * (tile + labelH + gap) + tile + 21;
    return `<text x="${x}" y="${y}" fill="#e8e4ef" font-family="Arial" font-size="17">${f}</text>`;
  })
  .join("");
await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: "#141019" } })
  .composite([
    ...cells.map((input, i) => ({
      input,
      left: gap + (i % cols) * (tile + gap),
      top: gap + Math.floor(i / cols) * (tile + labelH + gap),
    })),
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">${labels}</svg>`) },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "contact-sheet.png"));

console.log(`source   ${path.basename(SOURCE)} — ${N}x${N}, frame 0`);
console.log(`castle   ${cw}x${ch}  (delta ${CASTLE_DELTA})`);
console.log(`logotype ${lw}x${lh}  (cut ${LOGO_CUT})`);
console.log(`moon     ${r * 2}x${r * 2}`);
console.log(`\nwrote ${files.length + 2} files to ${path.relative(root, OUT)}/`);
