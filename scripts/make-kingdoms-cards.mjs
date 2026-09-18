#!/usr/bin/env node
/**
 * Title cards for the SNOW WHITE visualizer, in the KINGDOMS palette.
 *
 *   brand-art/kingdoms-cards/card-1-snow-white.png   the track
 *   brand-art/kingdoms-cards/card-2-ojinyx.png       the wordmark
 *   brand-art/kingdoms-cards/card-3-out-now.png      the call to action
 *   ...-alpha.png                                    same, transparent
 *   brand-art/kingdoms-cards/preview.png             all three together
 *
 * Run: npm run cards  [-- --record kingdoms] [-- --size 2048]
 *
 * ── Notes ─────────────────────────────────────────────────────────────────
 * Square, because these are cut into a square visualizer. Each card ships
 * twice: once on the blob field, and once on transparency so it can sit over
 * moving footage instead.
 *
 * Type is Unbounded, the site's display face, loaded from scripts/fonts rather
 * than from the machine — librsvg resolves families through fontconfig, so the
 * script writes its own fontconfig file pointing at that folder. Nothing has to
 * be installed for this to render the same anywhere.
 *
 * Text is sized by measurement, not by guesswork: `fitText` renders a phrase at
 * a reference size, trims to the ink, and scales from the result. Glyph metrics
 * vary enough between weights that estimating would leave the three cards
 * visibly inconsistent.
 *
 * Everything sits inside MARGIN. Video gets re-encoded and re-cropped by every
 * platform it passes through, so the cards keep well clear of the edge.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "brand-art", "kingdoms-cards");
const FONT_DIR = path.join(root, "scripts", "fonts");

// fontconfig is read once, when the rendering library initializes, so the
// config has to exist and be pointed at before sharp is imported.
const BS = String.fromCharCode(92);
const posix = (p) => p.split(BS).join("/");
const fcDir = path.join(os.tmpdir(), "ojinyx-fontconfig");
mkdirSync(fcDir, { recursive: true });
mkdirSync(path.join(fcDir, "cache"), { recursive: true });
const fcFile = path.join(fcDir, "fonts.conf");
await (await import("node:fs/promises")).writeFile(
  fcFile,
  `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${posix(FONT_DIR)}</dir>
  <dir>${posix(path.join(process.env.WINDIR || "C:/Windows", "Fonts"))}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>~/.fonts</dir>
  <cachedir>${posix(path.join(fcDir, "cache"))}</cachedir>
</fontconfig>
`,
);
process.env.FONTCONFIG_FILE = fcFile;

const sharp = (await import("sharp")).default;

const args = process.argv.slice(2);
const recordArg = args[args.indexOf("--record") + 1];
const RECORD = args.includes("--record") && recordArg ? recordArg : "kingdoms";
const sizeArg = Number(args[args.indexOf("--size") + 1]);
const S = Number.isFinite(sizeArg) && sizeArg > 0 ? Math.round(sizeArg) : 2048;

const BG = "#06020c";
const FG = "#f3eef7";
const MUTED = "#a99bb7";
const DISPLAY = "Unbounded";
/** Keep content this far from every edge, as a fraction of the card. */
const MARGIN = 0.1;

/**
 * Blob field for a square card. Deliberately dimmer and pushed further into the
 * corners than the banner fields: a title card needs a dark middle for the type
 * to sit in, where a banner is mostly field.
 */
const FIELD = [
  { i: 0, x: 0.1, y: 0.14, r: 0.42, o: 0.85 },
  { i: 1, x: 0.88, y: 0.26, r: 0.4, o: 0.8 },
  { i: 2, x: 0.24, y: 0.9, r: 0.42, o: 0.85 },
  { i: 0, x: 0.92, y: 0.94, r: 0.32, o: 0.6 },
  { i: 2, x: 0.6, y: -0.08, r: 0.28, o: 0.5 },
];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const raster = (svg, w, h, density = 144) =>
  sharp(Buffer.from(svg), { density, limitInputPixels: false })
    .resize({ width: Math.round(w), height: Math.round(h), fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

const gradientDef = (id, stops) => {
  const offsets = stops.map((_, i) => (stops.length === 1 ? 0 : Math.pow(i / (stops.length - 1), 0.82) * 100));
  return `<linearGradient id="${id}" x1="0" y1="0.15" x2="1" y2="0.7">
${stops.map((s, i) => `      <stop offset="${offsets[i].toFixed(1)}%" stop-color="${esc(s)}"/>`).join("\n")}
    </linearGradient>`;
};

function textSvg({ text, family, weight, size, tracking, fill, w, h, x, y }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="${x}" y="${y}" font-family="${esc(family)}" font-weight="${weight}" font-size="${size}"
        letter-spacing="${tracking}" fill="${fill}" text-anchor="start">${esc(text)}</text>
</svg>`;
}

/**
 * The ink bounding box of a phrase, in pixels, at the given font size.
 * Rendered onto a generous canvas and trimmed, because librsvg exposes no
 * text metrics and the alternative is guessing at glyph advances.
 */
async function measure({ text, family, weight, size, tracking }) {
  const w = Math.ceil(size * (text.length + 4) * 1.4);
  const h = Math.ceil(size * 3);
  const svg = textSvg({ text, family, weight, size, tracking, fill: "#ffffff", w, h, x: size, y: size * 2 });
  const out = await sharp(Buffer.from(svg), { density: 72 })
    .trim({ threshold: 1 })
    .toBuffer({ resolveWithObject: true });
  return {
    width: out.info.width,
    height: out.info.height,
    // Where the ink starts relative to the (x, y) the text was drawn at.
    dx: -(out.info.trimOffsetLeft ?? 0) - size,
    dy: -(out.info.trimOffsetTop ?? 0) - size * 2,
  };
}

/**
 * Size a phrase so its ink is exactly `targetWidth` wide, and return an SVG
 * fragment that draws it with its ink box at (left, top). Text scales linearly,
 * so one measurement at a reference size is enough.
 */
async function fitText({ text, family = DISPLAY, weight = 900, trackingEm = 0, targetWidth }) {
  const REF = 200;
  const refMetrics = await measure({ text, family, weight, size: REF, tracking: REF * trackingEm });
  const size = (REF * targetWidth) / refMetrics.width;
  const tracking = size * trackingEm;
  const m = await measure({ text, family, weight, size, tracking });
  return {
    size,
    tracking,
    width: m.width,
    height: m.height,
    /** Draw the phrase with its ink box's top-left corner at (left, top). */
    at(left, top, fill) {
      return `<text x="${left - m.dx}" y="${top - m.dy}" font-family="${esc(family)}" font-weight="${weight}"
        font-size="${size}" letter-spacing="${tracking}" fill="${fill}">${esc(text)}</text>`;
    },
  };
}

async function fieldLayers(stops) {
  const layers = [];
  for (const b of FIELD) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs><radialGradient id="b" cx="${b.x * S}" cy="${b.y * S}" r="${b.r * S}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${esc(stops[b.i])}" stop-opacity="1"/>
    <stop offset="0.45" stop-color="${esc(stops[b.i])}" stop-opacity="0.4"/>
    <stop offset="1" stop-color="${esc(stops[b.i])}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${S}" height="${S}" fill="url(#b)" opacity="${b.o}"/>
</svg>`;
    layers.push({ input: await raster(svg, S, S, 72), blend: "screen" });
  }
  // Dark pool through the middle third, so type always has something to sit on.
  const halo = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs><radialGradient id="h" cx="${S / 2}" cy="${S / 2}" r="${S * 0.58}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${BG}" stop-opacity="0.82"/>
    <stop offset="0.55" stop-color="${BG}" stop-opacity="0.5"/>
    <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${S}" height="${S}" fill="url(#h)"/>
</svg>`;
  layers.push({ input: await raster(halo, S, S, 72), blend: "over" });
  return layers;
}

/** Compose one card, on the field and on transparency. */
async function renderCard({ name, contentSvg, stops }) {
  const content = await raster(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs>${gradientDef("g", stops)}</defs>
${contentSvg}
</svg>`,
    S,
    S,
    216,
  );

  await writeFile(path.join(OUT, `${name}-alpha.png`), content);

  const onField = await sharp({ create: { width: S, height: S, channels: 4, background: BG } })
    .composite([...(await fieldLayers(stops)), { input: content, blend: "over" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(path.join(OUT, `${name}.png`), onField);
  return onField;
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

const inner = S * (1 - MARGIN * 2);
const made = [];

// ── Card 1: the track ────────────────────────────────────────────────────────
{
  const title = await fitText({ text: "SNOW WHITE", targetWidth: inner * 0.96, trackingEm: -0.01 });
  const rule = S * 0.004;
  const ruleW = title.width * 0.34;
  const ruleGap = S * 0.055;
  // Center the title AND its rule as one group, not the title alone — the rule
  // hangs below the type, so centering just the words leaves the card low.
  const top = (S - (title.height + ruleGap + rule)) / 2;
  made.push(
    await renderCard({
      name: "card-1-snow-white",
      stops,
      contentSvg: `  ${title.at((S - title.width) / 2, top, "url(#g)")}
  <rect x="${(S - ruleW) / 2}" y="${top + title.height + ruleGap}" width="${ruleW}" height="${rule}" rx="${rule / 2}" fill="${FG}" fill-opacity="0.75"/>`,
    }),
  );
}

// ── Card 2: the wordmark ─────────────────────────────────────────────────────
{
  const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);
  const markW = inner * 0.98;
  const markH = markW / (vw / vh);
  const scale = markH / vh;
  // Heavier than the banners: this gets re-encoded as video, and a stroke that
  // survives a still can still break up under inter-frame compression.
  const stroke = 6.5;
  made.push(
    await renderCard({
      name: "card-2-ojinyx",
      stops,
      contentSvg: `  <g transform="translate(${(S - markW) / 2} ${(S - markH) / 2}) scale(${scale}) translate(${-vx} ${-vy})">
    <path d="${pathData}" fill="none" stroke="url(#g)" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>
  </g>`,
    }),
  );
}

// ── Card 3: the call to action ───────────────────────────────────────────────
{
  const record = await fitText({ text: "KINGDOMS", targetWidth: inner * 0.96, trackingEm: -0.01 });
  const kicker = await fitText({ text: "OUT NOW ON", weight: 700, targetWidth: inner * 0.44, trackingEm: 0.18 });
  const site = await fitText({ text: "OJINYX.COM", weight: 700, targetWidth: inner * 0.7, trackingEm: 0.02 });

  const gap1 = S * 0.075;
  const gap2 = S * 0.035;
  const stackH = record.height + gap1 + kicker.height + gap2 + site.height;
  let y = (S - stackH) / 2;

  const lines = [];
  lines.push(record.at((S - record.width) / 2, y, "url(#g)"));
  y += record.height + gap1;
  lines.push(kicker.at((S - kicker.width) / 2, y, MUTED));
  y += kicker.height + gap2;
  lines.push(site.at((S - site.width) / 2, y, FG));

  made.push(await renderCard({ name: "card-3-out-now", stops, contentSvg: lines.map((l) => `  ${l}`).join("\n") }));
}

// ── Contact sheet ────────────────────────────────────────────────────────────
{
  const tile = 620;
  const gap = 18;
  const tiles = await Promise.all(made.map((b) => sharp(b).resize(tile, tile).toBuffer()));
  await sharp({ create: { width: tile * 3 + gap * 4, height: tile + gap * 2, channels: 4, background: "#141019" } })
    .composite(tiles.map((input, i) => ({ input, left: gap + i * (tile + gap), top: gap })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "preview.png"));
}

console.log(`record   ${RECORD}   ${stops.join(" → ")}`);
console.log(`type     ${DISPLAY}, from scripts/fonts`);
console.log(`cards    ${S}x${S}, each on the field and on transparency`);
console.log(`\nwrote 7 files to ${path.relative(root, OUT)}/`);
