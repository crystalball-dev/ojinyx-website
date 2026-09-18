#!/usr/bin/env node
/**
 * SoundCloud profile header, in the WAR ON DRUGS palette.
 *
 *   brand-art/soundcloud-header.png        2480x520 — upload this one
 *   brand-art/soundcloud-header@3x.png     7440x1560 master, for anything else
 *   brand-art/soundcloud-header-proof.png  how SoundCloud crops it
 *
 * Run: npm run soundcloud-banner  [-- --record war-on-drugs]
 *
 * ── Why it is shaped the way it is ────────────────────────────────────────
 * Measured on soundcloud.com/ojinyx (2026-09-17), not guessed:
 *
 *   • The header box is 254px tall always, and 1208px wide down to about a
 *     1265px window, then 928px below that.
 *   • The visual is drawn with `background-size: auto 100%; background-
 *     position: 0px 0px` — scaled to fill the HEIGHT and anchored LEFT, not
 *     center-cropped. So the image renders 1211px wide either way, and the
 *     narrow layout simply cuts the right 23.4% off. Nothing is ever cropped
 *     vertically, and there is no darkening overlay.
 *   • The avatar, display name, location and ARTIST PRO badge sit ON the
 *     banner, covering the left ~40% of it.
 *   • The CDN stores a t2480x520 variant, twice the widest display box, so
 *     unlike Genius this platform actually rewards a high-resolution upload.
 *     2480x520 lands 1:1 on that variant.
 *
 * Net: everything that matters goes between the overlay and the right-hand
 * crop — SAFE below. That band straddles the center, which is also what
 * SoundCloud's own guidance asks for on behalf of the mobile app.
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
 * Wordmark weight, in viewBox units. The merch line art uses 1.6. `--fill`
 * goes back to the solid mark, which is what Genius needs.
 */
const strokeArg = Number(args[args.indexOf("--stroke") + 1]);
const STROKE_UNITS = args.includes("--fill") ? 0 : Number.isFinite(strokeArg) && strokeArg > 0 ? strokeArg : 4.2;

/** SoundCloud's own recommended size, and the largest variant its CDN stores. */
const W = 2480;
const H = 520;
const MASTER_SCALE = 3;

/**
 * The band that is clear of the profile overlay AND survives the narrow
 * layout's right-hand crop, as fractions of the image.
 *
 * The overlay is laid out at FIXED PIXEL offsets from the header's left edge,
 * and the image always renders 1211px wide, so the overlay lands on the same
 * part of the art whatever the window is doing:
 *
 *   avatar                      28–226px   → image 0.023–0.187
 *   name / location / badge    258–441px   → image 0.213–0.364
 *   narrow layout clips at      928px      → image 0.766
 *
 * x1 stops well short of 0.766 rather than hugging it: a scrollbar or a page
 * zoom moves that edge a little, and the mark must not be the thing that
 * clips.
 */
const SAFE = { x0: 0.4, x1: 0.73, y0: 0.12, y1: 0.88 };

const BG = "#06020c";

/**
 * Blob field. Radii are fractions of the width. The strip is 4.77:1, so a
 * radius of 0.25W already covers the full height — these are washes, not dots.
 *
 * The trough between the left cluster and the right blob is where the mark
 * goes. The right blob sits at 0.86 so its core is past the narrow layout's
 * crop, but its falloff still reaches back over the mark; a core inside the
 * visible area would sit on top of the mark instead of behind it.
 */
const FIELD = [
  { i: 0, x: 0.05, y: 0.3, r: 0.25, o: 1.0 },
  { i: 1, x: 0.26, y: 0.95, r: 0.27, o: 0.95 },
  { i: 1, x: 0.52, y: 1.25, r: 0.24, o: 0.8 },
  { i: 2, x: 0.86, y: 0.36, r: 0.26, o: 1.0 },
  { i: 0, x: 1.02, y: 0.95, r: 0.16, o: 0.7 },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Rasterize an SVG to exactly w x h. librsvg scales user units by density/72. */
const raster = (svg, w, h, density = 144) =>
  sharp(Buffer.from(svg), { density, limitInputPixels: false })
    .resize({ width: Math.round(w), height: Math.round(h), fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

function blobSvg({ color, x, y, r, opacity, w, h }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><radialGradient id="b" cx="${x * w}" cy="${y * h}" r="${r * w}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${esc(color)}" stop-opacity="1"/>
    <stop offset="0.45" stop-color="${esc(color)}" stop-opacity="0.4"/>
    <stop offset="1" stop-color="${esc(color)}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#b)" opacity="${opacity}"/>
</svg>`;
}

/** A pool of darkness under the mark, so it never depends on the field staying dark. */
function haloSvg({ cx, cy, rx, w, h }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${rx}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${BG}" stop-opacity="0.74"/>
    <stop offset="0.5" stop-color="${BG}" stop-opacity="0.44"/>
    <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
</svg>`;
}

/**
 * The wordmark, either solid or as line art like the merch.
 *
 * `stroke` is in viewBox units, the same scale make-wordmark-art.mjs uses, so
 * 1.6 is exactly the merch weight. That weight is tuned for a garment print a
 * metre wide; here the mark renders about 370 CSS px across, where 1.6 units
 * comes out a hairline and the first resample eats it. STROKE_UNITS carries
 * more weight for that reason — same drawing, legible at this size.
 */
function markSvg({ pathData, viewBox, stops, box, w, h, stroke }) {
  const [vx, vy, , vh] = viewBox.split(/\s+/).map(Number);
  const scale = box.h / vh;
  const offsets = stops.map((_, i) => (stops.length === 1 ? 0 : Math.pow(i / (stops.length - 1), 0.82) * 100));
  const paint =
    stroke > 0
      ? `fill="none" stroke="url(#m)" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"`
      : `fill="url(#m)"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="m" x1="0" y1="0.2" x2="1" y2="0.62">
${stops.map((s, i) => `    <stop offset="${offsets[i].toFixed(1)}%" stop-color="${esc(s)}"/>`).join("\n")}
  </linearGradient></defs>
  <g transform="translate(${box.x} ${box.y}) scale(${scale}) translate(${-vx} ${-vy})">
    <path d="${pathData}" ${paint}/>
  </g>
</svg>`;
}

async function buildBanner({ pathData, viewBox, stops, w, h, stroke = STROKE_UNITS }) {
  const [, , vw, vh] = viewBox.split(/\s+/).map(Number);
  const aspect = vw / vh;

  // Centered in the safe band, sized to leave a margin on both sides of it.
  const markW = (SAFE.x1 - SAFE.x0) * 0.92 * w;
  const markH = markW / aspect;
  const box = { x: ((SAFE.x0 + SAFE.x1) / 2) * w - markW / 2, y: h / 2 - markH / 2, w: markW, h: markH };

  const layers = [];
  for (const b of FIELD) {
    layers.push({
      input: await raster(blobSvg({ color: stops[b.i], x: b.x, y: b.y, r: b.r, opacity: b.o, w, h }), w, h, 72),
      blend: "screen",
    });
  }
  layers.push({
    input: await raster(haloSvg({ cx: box.x + markW / 2, cy: h / 2, rx: markW * 1.25, w, h }), w, h, 72),
    blend: "over",
  });
  layers.push({
    input: await raster(markSvg({ pathData, viewBox, stops: [...stops].reverse(), box, w, h, stroke }), w, h, 216),
    blend: "over",
  });

  return sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof sheet

/**
 * The two real web layouts, measured. `scaled` is how wide the image renders
 * once it is scaled to the 254px box height (2480/520 * 254 = 1211).
 */
const RENDERED = Math.round((W / H) * 254);
const LAYOUTS = [
  { label: "web, window 1265px and up — header 1208x254 (image fits)", box: 1208 },
  { label: "web, window below 1265px — header 928x254 (right 23% cut)", box: 928 },
];

/**
 * Overlay geometry in PIXELS from the header's left edge — fixed, not a
 * fraction of the header, so it does not move when the layout narrows.
 */
const OVERLAY = {
  avatar: { x: 28, y: 28, size: 198 },
  text: { x0: 258, x1: 441, y0: 86, y1: 198 },
};

async function proofRow(banner, layout) {
  // auto 100% + position 0 0: fill the height, anchor left, clip the overflow.
  const filled = await sharp(banner).resize({ width: RENDERED, height: 254, fit: "fill" }).toBuffer();
  const strip = await sharp(filled)
    .extract({ left: 0, top: 0, width: Math.min(layout.box, RENDERED), height: 254 })
    .toBuffer();

  const b = layout.box;
  const av = OVERLAY.avatar;
  const tx = OVERLAY.text;
  const cx = av.x + av.size / 2;
  const cy = av.y + av.size / 2;
  const chrome = `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="254">
  <circle cx="${cx}" cy="${cy}" r="${av.size / 2}" fill="#181018" fill-opacity="0.92"
          stroke="#f3eef7" stroke-opacity="0.8" stroke-width="2"/>
  <text x="${cx}" y="${cy + 5}" fill="#f3eef7" fill-opacity="0.8" font-family="Arial" font-size="15" text-anchor="middle">avatar</text>
  <rect x="${tx.x0}" y="${tx.y0}" width="${tx.x1 - tx.x0}" height="${tx.y1 - tx.y0}"
        fill="#181018" fill-opacity="0.82" stroke="#f3eef7" stroke-opacity="0.5" stroke-width="2"/>
  <text x="${tx.x0 + 10}" y="${tx.y0 + 24}" fill="#f3eef7" fill-opacity="0.85" font-family="Arial" font-size="15">ojinyx</text>
  <text x="${tx.x0 + 10}" y="${tx.y0 + 48}" fill="#a99bb7" font-family="Arial" font-size="13">Drew · Wasilla</text>
  <text x="${tx.x0 + 10}" y="${tx.y0 + 72}" fill="#a99bb7" font-family="Arial" font-size="13">ARTIST PRO</text>
</svg>`;

  return sharp(strip).composite([{ input: await raster(chrome, b, 254, 144) }]).toBuffer();
}

async function buildProof(banner) {
  const pad = 22;
  const labelH = 26;
  const gap = 20;
  const rows = [];
  for (const l of LAYOUTS) rows.push({ label: l.label, box: l.box, buf: await proofRow(banner, l) });

  const sheetW = LAYOUTS[0].box + pad * 2;
  const totalH = pad * 2 + rows.length * (254 + labelH + gap);
  const labels = rows
    .map((r, i) => {
      const top = pad + i * (254 + labelH + gap);
      return `<text x="${pad}" y="${top + 17}" fill="#a99bb7" font-family="Arial" font-size="14">${esc(r.label)}</text>`;
    })
    .join("\n");

  await sharp({ create: { width: sheetW, height: totalH, channels: 4, background: "#141019" } })
    .composite([
      { input: await raster(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${totalH}">${labels}</svg>`, sheetW, totalH, 144) },
      ...rows.map((r, i) => ({ input: r.buf, left: pad, top: pad + labelH + i * (254 + labelH + gap) })),
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "soundcloud-header-proof.png"));
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

const upload = await buildBanner({ pathData, viewBox, stops, w: W, h: H });
await writeFile(path.join(OUT, "soundcloud-header.png"), upload);

const master = await buildBanner({ pathData, viewBox, stops, w: W * MASTER_SCALE, h: H * MASTER_SCALE });
await writeFile(path.join(OUT, `soundcloud-header@${MASTER_SCALE}x.png`), master);

await buildProof(upload);

const mb = (b) => (b.length / 1024 / 1024).toFixed(2);
console.log(`record   ${RECORD}   ${stops.join(" → ")}`);
console.log(`upload   ${W}x${H}        ${mb(upload)} MB   ${upload.length < 2 * 1024 * 1024 ? "under SoundCloud's 2 MB limit" : "OVER the 2 MB limit — re-run smaller"}`);
console.log(`master   ${W * MASTER_SCALE}x${H * MASTER_SCALE}      ${mb(master)} MB`);
console.log(`\nwrote 3 files to ${path.relative(root, OUT)}/`);
