#!/usr/bin/env node
/**
 * KINGDOMS merch lockup: the castle over the ojinyx line wordmark.
 *
 *   brand-art/kingdoms-assets/lockup-gradient.png   castle + gradient mark
 *   brand-art/kingdoms-assets/lockup-white.png      for dark garments
 *   brand-art/kingdoms-assets/lockup-black.png      for light garments
 *   brand-art/kingdoms-assets/lockup-overlay.png    mark across the ramparts
 *   brand-art/kingdoms-assets/lockup-preview.png    all four, dark and light
 *
 * Run: npm run lockup  [-- --stroke 2.4] [-- --record kingdoms]
 *
 * ── Notes ─────────────────────────────────────────────────────────────────
 * Built on castle-upper.png, the cut at the ramparts, because that part of the
 * artwork separates cleanly from the moon behind it. The island below it does
 * not separate at all — see the header of split-kingdoms-cover.mjs — so it is
 * left out rather than dragged in half-finished.
 *
 * Everything is sized from the castle's INK bounds, not its canvas: the file
 * carries 41px of transparent margin on the left and 77px on top, and centring
 * on the canvas would sit the wordmark visibly off-axis.
 *
 * The castle is never scaled up. It is 1806px of real ink, which is 6" at
 * 300dpi or 9" at 200dpi — fine for DTG at chest size, and upscaling to fake a
 * bigger number would only add softness. The wordmark is drawn from the vector,
 * so it stays crisp at whatever the canvas ends up being.
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "brand-art", "kingdoms-assets");
const CASTLE = path.join(OUT, "castle-upper.png");

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const RECORD = arg("record", "kingdoms");
/**
 * Stroke weight in wordmark viewBox units. The merch line art uses 1.6, which
 * is tuned for a print a metre wide; at this lockup's size that comes out
 * around 5px and looks frail next to a painted castle, so it runs heavier.
 * Compared 2.4 / 4.6 / 6.5 against the artwork before settling here.
 */
const STROKE = Number(arg("stroke", 4.6));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const gradients = JSON.parse(await readFile(path.join(root, "src", "content", "mark-gradients.generated.json"), "utf8"));
const stops = gradients[RECORD] ?? gradients.kingdoms;

const wordmarkSvg = await readFile(path.join(root, "public", "brand", "wordmark.svg"), "utf8");
const markPath = /<path[^>]*\sd="([^"]+)"/.exec(wordmarkSvg)?.[1];
const markBox = /viewBox="([^"]+)"/.exec(wordmarkSvg)?.[1];
if (!markPath || !markBox) {
  console.error("Could not read the wordmark path from public/brand/wordmark.svg");
  process.exit(1);
}
const [vx, vy, mvw, mvh] = markBox.split(/\s+/).map(Number);
const MARK_ASPECT = mvw / mvh;

// Trim to ink so the layout is driven by the castle itself, not its padding.
const trimmed = await sharp(CASTLE).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
const castle = trimmed.data;
const cw = trimmed.info.width;
const chh = trimmed.info.height;

/** The wordmark as an SVG layer, sized and placed in canvas pixels. */
function markLayer({ width, height, x, y, w, paint }) {
  const h = w / MARK_ASPECT;
  const scale = h / mvh;
  const fill =
    paint === "gradient"
      ? `stroke="url(#g)"`
      : `stroke="${paint}"`;
  const defs =
    paint === "gradient"
      ? `<defs><linearGradient id="g" x1="0" y1="0.1" x2="1" y2="0.7">
${stops.map((s, i) => `      <stop offset="${((i / (stops.length - 1)) * 100).toFixed(1)}%" stop-color="${esc(s)}"/>`).join("\n")}
    </linearGradient></defs>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${defs}
  <g transform="translate(${x} ${y}) scale(${scale}) translate(${-vx} ${-vy})">
    <path d="${markPath}" fill="none" ${fill} stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>`;
}

const raster = (svg, w, h) =>
  sharp(Buffer.from(svg), { density: 216, limitInputPixels: false })
    .resize({ width: Math.round(w), height: Math.round(h), fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

// ── Stacked: castle above, wordmark below ────────────────────────────────────
const markW = Math.round(cw * 0.94);
const markH = Math.round(markW / MARK_ASPECT);
const gap = Math.round(chh * 0.07);
const pad = Math.round(cw * 0.03);
const W = Math.max(cw, markW) + pad * 2;
const H = chh + gap + markH + pad * 2;

async function stacked(paint, name) {
  const layer = markLayer({
    width: W,
    height: H,
    x: (W - markW) / 2,
    y: pad + chh + gap,
    w: markW,
    paint,
  });
  const out = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: castle, left: Math.round((W - cw) / 2), top: pad },
      { input: await raster(layer, W, H) },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(OUT, name), out);
  return out;
}

const gradientLockup = await stacked("gradient", "lockup-gradient.png");
const whiteLockup = await stacked("#f3eef7", "lockup-white.png");
await stacked("#0b1016", "lockup-black.png");

// ── Overlay: the wordmark sitting across the ramparts ────────────────────────
// Placed low, where the castle is widest and darkest, so the line reads without
// fighting the spires.
const oMarkW = Math.round(cw * 0.86);
const oMarkH = Math.round(oMarkW / MARK_ASPECT);
const oPad = Math.round(cw * 0.03);
const OW = cw + oPad * 2;
const OH = chh + oPad * 2;
const overlay = await sharp({ create: { width: OW, height: OH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: castle, left: oPad, top: oPad },
    {
      input: await raster(
        markLayer({ width: OW, height: OH, x: (OW - oMarkW) / 2, y: oPad + chh - oMarkH * 1.02, w: oMarkW, paint: "#f3eef7" }),
        OW,
        OH,
      ),
    },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(path.join(OUT, "lockup-overlay.png"), overlay);

// ── Preview on both garment colors ───────────────────────────────────────────
const tileH = 900;
const items = [
  { buf: gradientLockup, label: "gradient", dark: true },
  { buf: whiteLockup, label: "white", dark: true },
  { buf: await readFile(path.join(OUT, "lockup-black.png")), label: "black", dark: false },
  { buf: overlay, label: "overlay", dark: true },
];
const cols = items.length;
const tileW = Math.round((tileH * W) / H) + 40;
const gapPx = 16;
const labelH = 30;
const sheetW = cols * (tileW + gapPx) + gapPx;
const sheetH = tileH + labelH + gapPx * 2;

const cells = [];
for (const it of items) {
  const bg = it.dark ? "#0b0710" : "#efecf3";
  const fitted = await sharp(it.buf).resize(tileW - 40, tileH - 40, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  cells.push(
    await sharp({ create: { width: tileW, height: tileH, channels: 4, background: bg } })
      .composite([{ input: fitted, gravity: "center" }])
      .png()
      .toBuffer(),
  );
}
const labels = items
  .map((it, i) => `<text x="${gapPx + i * (tileW + gapPx)}" y="${gapPx + tileH + 21}" fill="#a99bb7" font-family="Arial" font-size="16">${it.label}</text>`)
  .join("");
await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: "#141019" } })
  .composite([
    ...cells.map((input, i) => ({ input, left: gapPx + i * (tileW + gapPx), top: gapPx })),
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">${labels}</svg>`) },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "lockup-preview.png"));

console.log(`castle ink   ${cw}x${chh}`);
console.log(`stacked      ${W}x${H}   stroke ${STROKE}`);
console.log(`overlay      ${OW}x${OH}`);
console.log(`print        ${(cw / 300).toFixed(1)}" at 300dpi · ${(cw / 200).toFixed(1)}" at 200dpi`);
console.log(`\nwrote 5 files to ${path.relative(root, OUT)}/`);
