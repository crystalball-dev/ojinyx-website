#!/usr/bin/env node
/**
 * YouTube channel art, in the WAR ON DRUGS palette, with the wordmark drawn
 * as line art like the merch.
 *
 *   brand-art/youtube-banner.png        2560x1440 — upload this one
 *   brand-art/youtube-banner-proof.png  what each device actually shows
 *
 * Run: npm run youtube-banner  [-- --record kingdoms] [-- --stroke 5.5] [-- --fill]
 *
 * ── Why it is shaped the way it is ────────────────────────────────────────
 * Measured on youtube.com (2026-09-17):
 *
 *   • The desktop banner is a strip of CONSTANT 6.204:1 aspect at every
 *     window width — 1070x172 CSS px from about 1440px up, 1025x165 at 1265,
 *     769x124 at 1009. It is capped at 1070 wide; the old full-bleed banner
 *     is gone.
 *   • It is drawn with `object-fit: cover; object-position: 50% 50%`, so a
 *     16:9 upload is shown full width with the middle 1.778/6.204 = 28.7% of
 *     its height — y 0.357 to 0.643. Everything else is thrown away.
 *   • Nothing is overlaid on it. The avatar and channel name sit BELOW the
 *     banner, unlike Genius and SoundCloud, so the mark can be centered.
 *
 * From YouTube's own guidance rather than measured here — the phone and TV
 * apps cannot be inspected from a browser:
 *
 *   • Upload at 2560x1440 (16:9), under 6 MB.
 *   • 1546x423 centered is the area visible on ALL devices. That is the
 *     narrowest case, and it is what SAFE below encodes.
 *   • TV shows the whole 2560x1440, which is why the field is composed as a
 *     full 16:9 image and not just a strip.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "brand-art");

const args = process.argv.slice(2);
const recordArg = args[args.indexOf("--record") + 1];
const RECORD = args.includes("--record") && recordArg ? recordArg : "war-on-drugs";

/**
 * Wordmark weight in viewBox units — 1.6 is the merch line art. The mark lands
 * about 280 CSS px wide on desktop here versus ~370 on SoundCloud, so this runs
 * a little heavier than that script's 4.2 to keep the same weight on screen.
 */
const strokeArg = Number(args[args.indexOf("--stroke") + 1]);
const STROKE_UNITS = args.includes("--fill") ? 0 : Number.isFinite(strokeArg) && strokeArg > 0 ? strokeArg : 5.5;

const W = 2560;
const H = 1440;

/** YouTube's all-device safe area: 1546x423, centered. */
const SAFE = {
  x0: (W - 1546) / 2 / W,
  x1: (W + 1546) / 2 / W,
  y0: (H - 423) / 2 / H,
  y1: (H + 423) / 2 / H,
};

const BG = "#06020c";

/**
 * Blob field, as fractions of the width. Radii match the site's 72vmax blobs,
 * which on a 2560-wide canvas is a radius of ~0.36W.
 *
 * Composed twice over: as a full 16:9 image for TV and the upload preview, and
 * as the thin band from y 0.357 to 0.643 that desktop actually shows. Every
 * color therefore has a presence inside that band — a blob that only lives at
 * the top or bottom is invisible to almost everyone.
 */
const FIELD = [
  { i: 0, x: 0.09, y: 0.46, r: 0.3, o: 1.0 },
  { i: 1, x: 0.3, y: 0.74, r: 0.3, o: 1.0 },
  { i: 1, x: 0.52, y: 1.04, r: 0.26, o: 0.7 },
  { i: 2, x: 0.91, y: 0.44, r: 0.3, o: 1.0 },
  { i: 0, x: 0.72, y: 0.93, r: 0.22, o: 0.6 },
  { i: 2, x: 0.22, y: 0.06, r: 0.24, o: 0.6 },
  { i: 1, x: 0.8, y: 0.07, r: 0.22, o: 0.5 },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Rasterize an SVG to exactly w x h. librsvg scales user units by density/72. */
const raster = (svg, w, h, density = 144) =>
  sharp(Buffer.from(svg), { density, limitInputPixels: false })
    .resize({ width: Math.round(w), height: Math.round(h), fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

function blobSvg({ color, x, y, r, opacity }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="b" cx="${x * W}" cy="${y * H}" r="${r * W}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${esc(color)}" stop-opacity="1"/>
    <stop offset="0.45" stop-color="${esc(color)}" stop-opacity="0.4"/>
    <stop offset="1" stop-color="${esc(color)}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#b)" opacity="${opacity}"/>
</svg>`;
}

/** A pool of darkness under the mark, so the line never depends on the field. */
function haloSvg({ cx, cy, rx }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${rx}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${BG}" stop-opacity="0.74"/>
    <stop offset="0.5" stop-color="${BG}" stop-opacity="0.44"/>
    <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`;
}

function markSvg({ pathData, viewBox, stops, box, stroke }) {
  const [vx, vy, , vh] = viewBox.split(/\s+/).map(Number);
  const scale = box.h / vh;
  const offsets = stops.map((_, i) => (stops.length === 1 ? 0 : Math.pow(i / (stops.length - 1), 0.82) * 100));
  const paint =
    stroke > 0
      ? `fill="none" stroke="url(#m)" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"`
      // The wordmark's counters are wound the same way as their outers, so a
      // filled render needs evenodd; under the default nonzero the o closes up
      // into a solid hexagon.
      : `fill="url(#m)" fill-rule="evenodd"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="m" x1="0" y1="0.2" x2="1" y2="0.62">
${stops.map((s, i) => `    <stop offset="${offsets[i].toFixed(1)}%" stop-color="${esc(s)}"/>`).join("\n")}
  </linearGradient></defs>
  <g transform="translate(${box.x} ${box.y}) scale(${scale}) translate(${-vx} ${-vy})">
    <path d="${pathData}" ${paint}/>
  </g>
</svg>`;
}

async function buildBanner({ pathData, viewBox, stops, stroke = STROKE_UNITS }) {
  const [, , vw, vh] = viewBox.split(/\s+/).map(Number);
  const aspect = vw / vh;

  // Sized against the safe area's height, centered on the canvas. Two thirds
  // leaves the mark prominent in the desktop strip without crowding it.
  const markH = (SAFE.y1 - SAFE.y0) * H * 0.64;
  const markW = markH * aspect;
  const box = { x: W / 2 - markW / 2, y: H / 2 - markH / 2, w: markW, h: markH };

  const layers = [];
  for (const b of FIELD) {
    layers.push({
      input: await raster(blobSvg({ color: stops[b.i], x: b.x, y: b.y, r: b.r, opacity: b.o }), W, H, 72),
      blend: "screen",
    });
  }
  layers.push({ input: await raster(haloSvg({ cx: W / 2, cy: H / 2, rx: markW * 1.15 }), W, H, 72), blend: "over" });
  layers.push({
    input: await raster(markSvg({ pathData, viewBox, stops: [...stops].reverse(), box, stroke }), W, H, 216),
    blend: "over",
  });

  return sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof sheet

/**
 * `crop` is the region of the 2560x1440 upload each surface shows.
 * Desktop is measured; the rest is YouTube's published guidance, and the
 * labels say so rather than implying they were all checked the same way.
 */
const SURFACES = [
  { label: "TV — the whole 2560x1440 (YouTube guidance)", w: 2560, h: 1440, shade: true },
  { label: "desktop — 1070x172 strip, middle 28.7% of the height (measured)", w: 2560, h: 412 },
  { label: "tablet — 1855x423 (YouTube guidance)", w: 1855, h: 423 },
  { label: "phone — 1546x423, the all-device safe area (YouTube guidance)", w: 1546, h: 423 },
];

async function buildProof(banner) {
  const sheetW = 1180;
  const pad = 22;
  const labelH = 26;
  const gap = 18;

  const rows = [];
  for (const s of SURFACES) {
    const left = Math.round((W - s.w) / 2);
    const top = Math.round((H - s.h) / 2);
    let buf = await sharp(banner).extract({ left, top, width: s.w, height: s.h }).toBuffer();

    // On the full-frame row, outline the safe area so it is obvious how much
    // of the upload only ever reaches a television.
    if (s.shade) {
      const box = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}">
  <rect x="${SAFE.x0 * W}" y="${SAFE.y0 * H}" width="${(SAFE.x1 - SAFE.x0) * W}" height="${(SAFE.y1 - SAFE.y0) * H}"
        fill="none" stroke="#f3eef7" stroke-opacity="0.55" stroke-width="4" stroke-dasharray="18 12"/>
  <text x="${SAFE.x0 * W + 12}" y="${SAFE.y0 * H - 16}" fill="#f3eef7" fill-opacity="0.65"
        font-family="Arial" font-size="30">safe area — 1546x423</text>
</svg>`;
      buf = await sharp(buf).composite([{ input: await raster(box, s.w, s.h, 144) }]).toBuffer();
    }

    const h = Math.round((s.h * sheetW) / s.w);
    rows.push({ label: s.label, h, buf: await sharp(buf).resize({ width: sheetW, kernel: "lanczos3" }).toBuffer() });
  }

  const totalH = pad * 2 + rows.reduce((a, r) => a + r.h + labelH + gap, 0);
  const labels = rows
    .map((r, i) => {
      const top = pad + rows.slice(0, i).reduce((a, x) => a + x.h + labelH + gap, 0);
      return `<text x="${pad}" y="${top + 17}" fill="#a99bb7" font-family="Arial" font-size="14">${esc(r.label)}</text>`;
    })
    .join("\n");

  await sharp({ create: { width: sheetW + pad * 2, height: totalH, channels: 4, background: "#141019" } })
    .composite([
      { input: await raster(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW + pad * 2}" height="${totalH}">${labels}</svg>`, sheetW + pad * 2, totalH, 144) },
      ...rows.map((r, i) => ({
        input: r.buf,
        left: pad,
        top: pad + labelH + rows.slice(0, i).reduce((a, x) => a + x.h + labelH + gap, 0),
      })),
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "youtube-banner-proof.png"));
}

// ─────────────────────────────────────────────────────────────────────────────

const wordmarkSvg = await readFile(path.join(root, "public", "brand", "wordmark.svg"), "utf8");
const pathData = /<path[^>]*\sd="([^"]+)"/.exec(wordmarkSvg)?.[1];
const viewBox = /viewBox="([^"]+)"/.exec(wordmarkSvg)?.[1];
if (!pathData || !viewBox) {
  console.error("Could not read the wordmark path from public/brand/wordmark.svg");
  process.exit(1);
}

const gradients = JSON.parse(await readFile(path.join(root, "src", "content", "mark-gradients.generated.json"), "utf8"));
const stops = gradients[RECORD];
if (!stops) {
  console.error(`No gradient for "${RECORD}". Known: ${Object.keys(gradients).join(", ")}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const banner = await buildBanner({ pathData, viewBox, stops });
await writeFile(path.join(OUT, "youtube-banner.png"), banner);
await buildProof(banner);

const mb = (banner.length / 1024 / 1024).toFixed(2);
console.log(`record   ${RECORD}   ${stops.join(" → ")}`);
console.log(`mark     ${STROKE_UNITS > 0 ? `line art, stroke ${STROKE_UNITS}` : "solid"}`);
console.log(`upload   ${W}x${H}      ${mb} MB   ${banner.length < 6 * 1024 * 1024 ? "under YouTube's 6 MB limit" : "OVER the 6 MB limit"}`);
console.log(`\nwrote 2 files to ${path.relative(root, OUT)}/`);
