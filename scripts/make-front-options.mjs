#!/usr/bin/env node
/**
 * Front-of-garment options, mocked against the full-back KINGDOMS print.
 *
 *   brand-art/kingdoms-assets/front-options.png   back print + four fronts
 *   brand-art/kingdoms-assets/sigil-white.png     the Ø mark, redrawn clean
 *   brand-art/kingdoms-assets/sigil-black.png     same, for light garments
 *
 * Run: npm run fronts -- --back <path to the back design png/webp>
 *
 * ── The Ø ─────────────────────────────────────────────────────────────────
 * The castle already carries a slashed-O sigil on its right rampart, and the
 * album logotype sets KINGDØMS with the same slash. It is redrawn here as
 * clean geometry rather than lifted from the painting: the painted one is
 * 160px of brushwork with atmospheric haze over it, which would not survive
 * being printed at 2 inches, and a mark wants to be a shape rather than a
 * picture of a shape.
 *
 * Proportions follow the artwork — the slash overshoots the circle at both
 * ends, and the stroke is a little over a tenth of the diameter.
 *
 * ── Scale ─────────────────────────────────────────────────────────────────
 * Everything is drawn at 50px per inch on a schematic 20x28" tee, so the
 * sizes on screen are the sizes on the garment. A chest mark reads at 3-4"
 * wide and a full back print at 12". Judging these at screen scale instead is
 * how chest prints end up twice the size they should be.
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "brand-art", "kingdoms-assets");

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const BACK = arg("back");
if (!BACK) {
  console.error('Pass --back "<path to a back design>".');
  process.exit(1);
}

/** Pixels per inch for the mock. */
const PPI = 50;
const inch = (v) => Math.round(v * PPI);

const GARMENT = "#12121a";
const INK = "#f3eef7";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const wordmarkSvg = await readFile(path.join(root, "public", "brand", "wordmark.svg"), "utf8");
const markPath = /<path[^>]*\sd="([^"]+)"/.exec(wordmarkSvg)?.[1];
const markBox = /viewBox="([^"]+)"/.exec(wordmarkSvg)?.[1];
const [vx, vy, mvw, mvh] = markBox.split(/\s+/).map(Number);
const MARK_ASPECT = mvw / mvh;

/**
 * The Ø, as geometry. `d` is the circle diameter; the slash runs lower-left to
 * upper-right and overshoots, as it does in the painting.
 */
function sigil({ cx, cy, d, color, weight = 0.115 }) {
  const r = d / 2;
  const sw = d * weight;
  const o = r * 1.2;
  return `<circle cx="${cx}" cy="${cy}" r="${r - sw / 2}" fill="none" stroke="${color}" stroke-width="${sw}"/>
  <line x1="${cx - o * 0.72}" y1="${cy + o * 0.72}" x2="${cx + o * 0.72}" y2="${cy - o * 0.72}"
        stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

/** The ojinyx line wordmark, placed by its top-left and width. */
function wordmark({ x, y, w, color, stroke = 5.5 }) {
  const h = w / MARK_ASPECT;
  return `<g transform="translate(${x} ${y}) scale(${h / mvh}) translate(${-vx} ${-vy})">
    <path d="${markPath}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linejoin="round" stroke-linecap="round"/>
  </g>`;
}

// ── Standalone sigil assets, at print resolution ─────────────────────────────
for (const [name, color] of [
  ["sigil-white.png", INK],
  ["sigil-black.png", "#0b1016"],
]) {
  const S = 1200;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  ${sigil({ cx: S / 2, cy: S / 2, d: S * 0.74, color })}
</svg>`;
  await writeFile(
    path.join(OUT, name),
    await sharp(Buffer.from(svg), { density: 216 }).resize(S, S, { fit: "fill" }).png({ compressionLevel: 9 }).toBuffer(),
  );
}

// ── Garment mock ─────────────────────────────────────────────────────────────
const TW = inch(24);
const TH = inch(31);

/** Schematic tee: 20" across the body, 28" long, sleeves out to 24". */
const TEE = `M ${inch(9.6)} ${inch(3)}
  L ${inch(6)} ${inch(3)} L ${inch(0.8)} ${inch(6.6)} L ${inch(0.8)} ${inch(8.6)}
  L ${inch(3.4)} ${inch(9.4)} L ${inch(3)} ${inch(29)}
  L ${inch(21)} ${inch(29)} L ${inch(20.6)} ${inch(9.4)}
  L ${inch(23.2)} ${inch(8.6)} L ${inch(23.2)} ${inch(6.6)}
  L ${inch(18)} ${inch(3)} L ${inch(14.4)} ${inch(3)}
  C ${inch(13.2)} ${inch(4.6)}, ${inch(10.8)} ${inch(4.6)}, ${inch(9.6)} ${inch(3)} Z`;

const teeBase = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}">
  <path d="${TEE}" fill="${GARMENT}" stroke="#2a2a38" stroke-width="3"/>
  <text x="${TW / 2}" y="${TH - 14}" fill="#a99bb7" font-family="Arial" font-size="26" text-anchor="middle">${esc(label)}</text>
</svg>`;

/** Chest mark position — the small-print spot, about 3" below the collar. */
const CHEST_X = inch(7.2);
const CHEST_Y = inch(7.4);

const fronts = [
  {
    label: "A · wordmark, 3.5\"",
    art: wordmark({ x: CHEST_X, y: CHEST_Y, w: inch(3.5), color: INK, stroke: 6.5 }),
  },
  {
    label: "B · Ø sigil, 2.2\"",
    art: sigil({ cx: CHEST_X + inch(1.1), cy: CHEST_Y + inch(1.1), d: inch(2.2), color: INK }),
  },
  {
    label: "C · wordmark + imprint",
    art:
      wordmark({ x: CHEST_X, y: CHEST_Y, w: inch(3.5), color: INK, stroke: 6.5 }) +
      `<text x="${CHEST_X + inch(1.75)}" y="${CHEST_Y + inch(3.5) / MARK_ASPECT + inch(0.62)}" fill="${INK}" fill-opacity="0.75"
         font-family="Arial" font-size="${inch(0.2)}" letter-spacing="${inch(0.055)}" text-anchor="middle">OPERATION FAIRWAY</text>`,
  },
  {
    label: "D · Ø centered, 4\"",
    art: sigil({ cx: TW / 2, cy: inch(9.5), d: inch(4), color: INK }),
  },
];

const panels = [];

// Back panel, with the artwork at a 12" full-back print.
const backArt = await sharp(BACK).resize(inch(12), null, { fit: "inside" }).toBuffer();
const backMeta = await sharp(backArt).metadata();
panels.push({
  label: "BACK · 12\" print",
  buf: await sharp(Buffer.from(teeBase("BACK · 12\" print")))
    .composite([{ input: backArt, left: Math.round((TW - backMeta.width) / 2), top: inch(6.2) }])
    .png()
    .toBuffer(),
});

for (const f of fronts) {
  const layer = `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${TH}">${f.art}</svg>`;
  panels.push({
    label: f.label,
    buf: await sharp(Buffer.from(teeBase(f.label)))
      .composite([{ input: await sharp(Buffer.from(layer), { density: 216 }).resize(TW, TH, { fit: "fill" }).png().toBuffer() }])
      .png()
      .toBuffer(),
  });
}

const gapPx = 18;
const sheetW = panels.length * (TW + gapPx) + gapPx;
const sheetH = TH + gapPx * 2;
await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: "#08060c" } })
  .composite(panels.map((p, i) => ({ input: p.buf, left: gapPx + i * (TW + gapPx), top: gapPx })))
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "front-options.png"));

console.log(`mock at ${PPI}px/inch on a 20x28" tee`);
console.log(`back print  12" wide`);
console.log(`chest marks 2.2-4"`);
console.log(`\nwrote front-options.png, sigil-white.png, sigil-black.png`);
