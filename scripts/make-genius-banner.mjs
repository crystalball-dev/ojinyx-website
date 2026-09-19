#!/usr/bin/env node
/**
 * Genius artist-page banner, built from the same parts as the site: the
 * plum-black field, the drifting color blobs from the home page, and the
 * wordmark filled with a record's gradient.
 *
 *   brand-art/genius-banner.png            primary — brand blobs, self-titled gradient
 *   brand-art/genius-banner-<slug>.png     one per record
 *   brand-art/genius-banner-proof.png      how Genius actually crops it, at five widths
 *   brand-art/genius-banner-variants.png   all four records side by side
 *
 * Run: npm run genius-banner  [-- --width 3200]
 *
 * ── Why it is shaped the way it is ────────────────────────────────────────
 * Measured on genius.com/artists/Ojinyx (2026-09-17), not guessed:
 *
 *   • The header strip is 287px tall at desktop and 105px on a phone, and it
 *     runs the full page width. Genius inflates the image layer by 16px on
 *     every side and blurs it 2px, so the box that actually gets filled is
 *     (viewport + 32) x 319 on desktop, 407 x 137 on a phone.
 *   • That box is filled with `background-size: cover; background-position:
 *     50% 50%` — dead-center crop, no art direction. Its aspect runs from
 *     ~2.97:1 on a phone to ~8:1 on a 2560px monitor. ONE image has to
 *     survive that whole range, so anything that matters lives in the middle.
 *   • Genius lays `linear-gradient(rgba(0,0,0,.1) 70%, rgba(0,0,0,.7) 93%,
 *     #000 99%)` over the strip: the bottom ~30% is crushed to black.
 *   • The round avatar sits over the left of the strip — roughly x 0.05–0.43
 *     of the width depending on viewport.
 *   • The CDN only serves the one stored variant (asking for anything larger
 *     than ~1000px wide returns 403), so the art is downsampled to 1000px
 *     wide and then stretched back up to ~1950px on a desktop. Fine detail is
 *     destroyed. Hence big soft shapes and a SOLID wordmark rather than the
 *     line art used for merch — a hairline stroke turns to mush.
 *
 * The constants below encode that: a 4:1 canvas, payload inside SAFE, and the
 * wordmark right of center where the avatar never reaches.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "brand-art");

const args = process.argv.slice(2);
const widthArg = Number(args[args.indexOf("--width") + 1]);
/**
 * Wordmark weight in viewBox units, matching make-wordmark-art.mjs, where the
 * merch line art is 1.6. `--line` opts into an outlined mark; see the note in
 * markSvg for why this platform defaults to solid.
 */
const strokeArg = Number(args[args.indexOf("--stroke") + 1]);
const STROKE_UNITS = args.includes("--line") ? (Number.isFinite(strokeArg) && strokeArg > 0 ? strokeArg : 4.2) : 0;
const W = Number.isFinite(widthArg) && widthArg > 0 ? Math.round(widthArg) : 3200;
const H = Math.round(W / 4); // 4:1 — the best compromise across phone and ultrawide

/** Fractions of the canvas that survive every crop AND sit above Genius's black fade. */
const SAFE = { x0: 0.13, x1: 0.87, y0: 0.24, y1: 0.62 };

/** Site brand tokens, copied from src/app/globals.css :root. */
const BRAND = {
  bg: "#06020c",
  accent: "#ff2bd6",
  accent2: "#c6ff00",
  accent3: "#5b3dff",
  accent4: "#ff4a1f",
};

/**
 * Blob field. Positions and radii are fractions of the canvas width, sized to
 * match the site: `.blob` is 72vmax, which on a strip this shape is a radius of
 * ~0.36W. They have to be that big and overlap that much or the strip reads as
 * a few glowing dots on black instead of one saturated wash.
 *
 * The trough between the indigo (0.33) and the magenta (0.93) is deliberate:
 * that is where the wordmark sits, so it has something to read against. The
 * acid green is left out of the field on purpose: it is the mark's own color,
 * and everywhere it overlapped the magenta it went olive and muddied both.
 */
const FIELD = [
  { c: "accent", x: 0.08, y: 0.36, r: 0.36, o: 1.0 },
  { c: "accent3", x: 0.33, y: 0.88, r: 0.38, o: 0.95 },
  { c: "accent4", x: 0.47, y: 0.08, r: 0.24, o: 0.55 },
  { c: "accent", x: 0.93, y: 0.46, r: 0.34, o: 1.0 },
  { c: "accent3", x: 1.0, y: 0.95, r: 0.22, o: 0.8 },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Rasterize an SVG to exactly w x h. librsvg scales SVG user units by
 * density/72, so rendering above the target and scaling back down both pins
 * the size and supersamples the curves.
 */
const raster = (svg, w, h, density = 144) =>
  sharp(Buffer.from(svg), { density, limitInputPixels: false })
    .resize({ width: Math.round(w), height: Math.round(h), fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

/** One soft circle, matching the .blob radial-gradient in globals.css. */
function blobSvg({ color, x, y, r, opacity }) {
  const cx = x * W;
  const cy = y * H;
  const rad = r * W;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="b" cx="${cx}" cy="${cy}" r="${rad}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${color}" stop-opacity="1"/>
    <stop offset="0.45" stop-color="${color}" stop-opacity="0.4"/>
    <stop offset="1" stop-color="${color}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#b)" opacity="${opacity}"/>
</svg>`;
}

/**
 * A pool of darkness under the wordmark. The blobs drift in the design but the
 * wordmark must never lose contrast, so this is composited over them and under
 * the mark rather than trusting the layout to stay dark.
 */
function haloSvg({ cx, cy, rx }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="h" cx="${cx}" cy="${cy}" r="${rx}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${BRAND.bg}" stop-opacity="0.72"/>
    <stop offset="0.5" stop-color="${BRAND.bg}" stop-opacity="0.42"/>
    <stop offset="1" stop-color="${BRAND.bg}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#h)"/>
</svg>`;
}

/**
 * The wordmark, placed in the safe band. Solid by default here, unlike the
 * SoundCloud header: Genius caps its stored image near 1000px wide and blurs
 * it 2px, and a stroke thin enough to read as line art does not survive that.
 * `--line` renders it anyway — check genius-banner-proof.png before trusting it.
 */
function markSvg({ pathData, viewBox, stops, box, stroke = STROKE_UNITS }) {
  const [vx, vy, , vh] = viewBox.split(/\s+/).map(Number);
  const scale = box.h / vh;
  const offsets = stops.map((_, i) => (stops.length === 1 ? 0 : Math.pow(i / (stops.length - 1), 0.82) * 100));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="m" x1="0" y1="0.2" x2="1" y2="0.62">
${stops.map((s, i) => `    <stop offset="${offsets[i].toFixed(1)}%" stop-color="${esc(s)}"/>`).join("\n")}
  </linearGradient></defs>
  <g transform="translate(${box.x} ${box.y}) scale(${scale}) translate(${-vx} ${-vy})">
    <path d="${pathData}" ${stroke > 0 ? `fill="none" stroke="url(#m)" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"` : `fill="url(#m)" fill-rule="evenodd"`}/>
  </g>
</svg>`;
}

async function buildBanner({ pathData, viewBox, fieldColors, markStops }) {
  const [, , vw, vh] = viewBox.split(/\s+/).map(Number);
  const aspect = vw / vh;

  // Fill the safe band's height, centered right of the avatar.
  const markH = (SAFE.y1 - SAFE.y0) * H;
  const markW = markH * aspect;
  const box = { x: 0.62 * W - markW / 2, y: SAFE.y0 * H, w: markW, h: markH };

  const layers = [];
  for (const b of FIELD) {
    layers.push({
      input: await raster(blobSvg({ color: fieldColors[b.c], x: b.x, y: b.y, r: b.r, opacity: b.o }), W, H, 72),
      blend: "screen",
    });
  }
  layers.push({
    input: await raster(haloSvg({ cx: box.x + markW / 2, cy: box.y + markH / 2, rx: markW * 1.4 }), W, H, 72),
    blend: "over",
  });
  layers.push({
    input: await raster(markSvg({ pathData, viewBox, stops: markStops, box }), W, H, 216),
    blend: "over",
  });

  return sharp({ create: { width: W, height: H, channels: 4, background: BRAND.bg } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof sheet: what the banner looks like after Genius is done with it.

/** Measured from genius.com. `av` is the avatar box as a fraction of the strip. */
const VIEWPORTS = [
  { label: "phone  375", vw: 375, strip: 105, av: { x: 18 / 375, w: 105 / 375 } },
  { label: "laptop 1024", vw: 1009, strip: 287, av: { x: 72 / 1009, w: 287 / 1009 } },
  { label: "desktop 1440", vw: 1425, strip: 287, av: { x: 280 / 1425, w: 287 / 1425 } },
  { label: "desktop 1920", vw: 1905, strip: 287, av: { x: 527 / 1905, w: 287 / 1905 } },
  { label: "ultrawide 2560", vw: 2545, strip: 287, av: { x: 847 / 2545, w: 287 / 2545 } },
];

async function proofRow(banner, vp, maxW) {
  const boxW = vp.vw + 32; // Genius inflates the image layer 16px each side
  const boxH = vp.strip + 32;

  // cover-crop + the 2px blur Genius applies to the layer
  const cropped = await sharp(banner).resize(boxW, boxH, { fit: "cover", position: "center" }).blur(2).toBuffer();

  // The strip itself is the inner box; then Genius's fade-to-black.
  const fade = `<svg xmlns="http://www.w3.org/2000/svg" width="${vp.vw}" height="${vp.strip}">
  <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
    <stop offset="70%" stop-color="#000" stop-opacity="0.1"/>
    <stop offset="93%" stop-color="#000" stop-opacity="0.7"/>
    <stop offset="99%" stop-color="#000" stop-opacity="1"/>
  </linearGradient></defs>
  <rect width="${vp.vw}" height="${vp.strip}" fill="url(#f)"/>
</svg>`;

  const avX = vp.av.x * vp.vw;
  const avW = vp.av.w * vp.vw;
  const avTop = Math.round(vp.strip * 0.108); // avatar hangs below the strip by the same amount
  const avatar = `<svg xmlns="http://www.w3.org/2000/svg" width="${vp.vw}" height="${vp.strip}">
  <circle cx="${avX + avW / 2}" cy="${avTop + avW / 2}" r="${avW / 2}" fill="#181018" stroke="#f3eef7" stroke-width="3" stroke-opacity="0.85"/>
  <text x="${avX + avW / 2}" y="${avTop + avW / 2}" fill="#f3eef7" fill-opacity="0.75"
        font-family="Arial" font-size="${Math.round(avW * 0.13)}" text-anchor="middle">avatar</text>
</svg>`;

  const strip = await sharp(cropped)
    .extract({ left: 16, top: 16, width: vp.vw, height: vp.strip })
    .composite([
      { input: await raster(fade, vp.vw, vp.strip, 72) },
      { input: await raster(avatar, vp.vw, vp.strip, 144) },
    ])
    .toBuffer();

  // Scale every row to one sheet width so they compare like-for-like.
  return {
    label: vp.label,
    buf: await sharp(strip).resize({ width: maxW, kernel: "lanczos3" }).toBuffer(),
    height: Math.round((vp.strip * maxW) / vp.vw),
  };
}

async function buildProof(banner) {
  const sheetW = 1400;
  const rows = [];
  for (const vp of VIEWPORTS) rows.push(await proofRow(banner, vp, sheetW));

  const gap = 20;
  const labelH = 26;
  const pad = 24;
  const totalH = pad * 2 + rows.reduce((a, r) => a + r.height + labelH + gap, 0);

  const labels = rows
    .map((r, i) => {
      const top = pad + rows.slice(0, i).reduce((a, x) => a + x.height + labelH + gap, 0);
      return `<text x="${pad}" y="${top + 17}" fill="#a99bb7" font-family="Arial" font-size="15">${esc(r.label)}</text>`;
    })
    .join("\n");

  return sharp({ create: { width: sheetW + pad * 2, height: totalH, channels: 4, background: "#141019" } })
    .composite([
      {
        input: await raster(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW + pad * 2}" height="${totalH}">${labels}</svg>`,
          sheetW + pad * 2, totalH, 144,
        ),
      },
      ...rows.map((r, i) => ({
        input: r.buf,
        left: pad,
        top: pad + labelH + rows.slice(0, i).reduce((a, x) => a + x.height + labelH + gap, 0),
      })),
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "genius-banner-proof.png"));
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
if (!gradients.ojinyx) {
  console.error("mark-gradients.generated.json has no `ojinyx` entry — run `npm run merch-art` first.");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

// Primary: the home page's own blob colors, wordmark in the self-titled gradient.
const primary = await buildBanner({ pathData, viewBox, fieldColors: BRAND, markStops: gradients.ojinyx });
await writeFile(path.join(OUT, "genius-banner.png"), primary);
console.log(`- primary        ${W}x${H}  ${(primary.length / 1024).toFixed(0)} KB   ${gradients.ojinyx.join(" → ")}`);

// One per record: the field and the mark both come from that cover.
const variants = [];
for (const [slug, stops] of Object.entries(gradients)) {
  // All three cover stops appear in the field; the mark runs them in reverse so
  // it never lands on the same color as the blob immediately behind it.
  const fieldColors = { bg: BRAND.bg, accent: stops[0], accent3: stops[1], accent4: stops[2], accent2: stops[2] };
  const buf = await buildBanner({ pathData, viewBox, fieldColors, markStops: [...stops].reverse() });
  await writeFile(path.join(OUT, `genius-banner-${slug}.png`), buf);
  variants.push(buf);
  console.log(`- ${slug.padEnd(14)} ${W}x${H}  ${(buf.length / 1024).toFixed(0)} KB   ${stops.join(" → ")}`);
}

// Contact sheet, so the four records can be compared without opening four files.
const tileW = 1500;
const tileH = Math.round(tileW / 4);
const gap = 14;
await sharp({ create: { width: tileW, height: (tileH + gap) * variants.length + gap, channels: 4, background: "#141019" } })
  .composite(
    await Promise.all(
      variants.map(async (buf, i) => ({
        input: await sharp(buf).resize(tileW, tileH).toBuffer(),
        left: 0,
        top: gap + i * (tileH + gap),
      })),
    ),
  )
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "genius-banner-variants.png"));

await buildProof(primary);
console.log(`\nwrote ${Object.keys(gradients).length + 3} files to ${path.relative(root, OUT)}/`);
console.log("Upload genius-banner.png as the header image; check genius-banner-proof.png for the crops.");
