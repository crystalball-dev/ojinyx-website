#!/usr/bin/env node
/**
 * Vertical social clip cut from a music video, framed in the record's palette.
 *
 *   brand-art/clips/<slug>-<start>-<dur>s.mp4
 *
 * Run:
 *   npm run clip -- --video "E:/.../SNOW WHITE.MP4" --start 76 --duration 10 --title "SNOW WHITE"
 *
 * ── Why it is framed rather than cropped ──────────────────────────────────
 * Cropping 16:9 to 9:16 keeps 31.6% of the width and throws the rest away.
 * This footage puts action right across the frame, so a center crop loses the
 * composition. The clip instead sits full width inside a 9:16 field built from
 * the same blobs as the site, which leaves room above and below for the mark
 * and the call to action — space a crop would have spent on nothing.
 *
 * ── Encoding ──────────────────────────────────────────────────────────────
 * Instagram's documented Reels target is 1080x1920, H.264, 30fps, AAC 48 kHz,
 * under 4 GB. Nothing here comes close to that ceiling, so the settings aim at
 * surviving THEIR re-encode rather than at a size limit: CRF 18 with a 12 Mb/s
 * cap gives their encoder a clean source, and `-movflags +faststart` puts the
 * moov atom first so the upload is not held up parsing the tail.
 *
 * 30fps is the default because it is the documented target and leaves their
 * encoder the least to do. The source is 60fps and this footage is all motion,
 * so `--fps 60` is there if the stutter matters more than the safe path.
 *
 * The grade is left alone. These frames are very dark and a lift would help
 * them survive Instagram's compression, but that is the artist's call, not a
 * default — `--lift` opts in.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdirSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);
const root = process.cwd();
const OUT = path.join(root, "brand-art", "clips");
const FONT_DIR = path.join(root, "scripts", "fonts");

const BS = String.fromCharCode(92);
const posix = (p) => p.split(BS).join("/");
const fcDir = path.join(os.tmpdir(), "ojinyx-fontconfig");
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
  <cachedir>${posix(path.join(fcDir, "cache"))}</cachedir>
</fontconfig>
`,
);
process.env.FONTCONFIG_FILE = fcFile;

const sharp = (await import("sharp")).default;

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const VIDEO = arg("video");
const START = Number(arg("start", 0));
const DURATION = Number(arg("duration", 10));
const TITLE = arg("title", "SNOW WHITE");
const RECORD = arg("record", "kingdoms");
const FPS = Number(arg("fps", 30));
const LIFT = args.includes("--lift");
const SITE = arg("site", "OJINYX.COM");

if (!VIDEO) {
  console.error('Pass --video "<path to the mp4>".');
  process.exit(1);
}

const W = 1080;
const H = 1920;

/**
 * How much of the 9:16 frame the clip occupies, and what it costs.
 *
 *   wide   — 16:9 untouched, full width. Keeps the whole composition, but the
 *            clip is only 608 of 1920 rows, about a third of the screen.
 *   square — center-cropped to 1:1. Keeps 56% of the source width instead of
 *            the 31.6% a straight 9:16 crop would keep, and fills 56% of the
 *            screen instead of 32%. More present, at the cost of the frame edges.
 *
 * Instagram lays its caption, audio strip and buttons over roughly the bottom
 * 320px and the right 120px of a Reel, so both layouts stay above y = 1600.
 */
const FIT = arg("fit", "wide") === "square" ? "square" : "wide";
const VW = W;
const VH = FIT === "square" ? W : Math.round((W * 9) / 16);
const VY = FIT === "square" ? 430 : 560;

const BG = "#06020c";
const FG = "#f3eef7";
const MUTED = "#a99bb7";
const DISPLAY = "Unbounded";

/** Blob field, corner-weighted so the middle stays dark behind the clip. */
const FIELD = [
  { i: 0, x: 0.08, y: 0.08, r: 0.46, o: 0.8 },
  { i: 1, x: 0.95, y: 0.2, r: 0.4, o: 0.7 },
  { i: 2, x: 0.12, y: 0.86, r: 0.44, o: 0.85 },
  { i: 1, x: 0.92, y: 0.95, r: 0.38, o: 0.7 },
];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const raster = (svg, w, h, density = 144) =>
  sharp(Buffer.from(svg), { density, limitInputPixels: false })
    .resize({ width: Math.round(w), height: Math.round(h), fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

async function measure({ text, weight, size, tracking }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * (text.length + 4) * 1.5)}" height="${Math.ceil(size * 3)}">
  <text x="${size}" y="${size * 2}" font-family="${esc(DISPLAY)}" font-weight="${weight}" font-size="${size}"
        letter-spacing="${tracking}" fill="#fff">${esc(text)}</text></svg>`;
  const o = await sharp(Buffer.from(svg), { density: 72 }).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  return {
    width: o.info.width,
    height: o.info.height,
    dx: -(o.info.trimOffsetLeft ?? 0) - size,
    dy: -(o.info.trimOffsetTop ?? 0) - size * 2,
  };
}

async function fitText({ text, weight = 900, trackingEm = 0, targetWidth }) {
  const REF = 200;
  const ref = await measure({ text, weight, size: REF, tracking: REF * trackingEm });
  const size = (REF * targetWidth) / ref.width;
  const tracking = size * trackingEm;
  const m = await measure({ text, weight, size, tracking });
  return {
    width: m.width,
    height: m.height,
    at: (left, top, fill) =>
      `<text x="${left - m.dx}" y="${top - m.dy}" font-family="${esc(DISPLAY)}" font-weight="${weight}"
        font-size="${size}" letter-spacing="${tracking}" fill="${fill}">${esc(text)}</text>`,
  };
}

const gradients = JSON.parse(await readFile(path.join(root, "src", "content", "mark-gradients.generated.json"), "utf8"));
const stops = gradients[RECORD] ?? gradients.kingdoms;

const wordmarkSvg = await readFile(path.join(root, "public", "brand", "wordmark.svg"), "utf8");
const markPath = /<path[^>]*\sd="([^"]+)"/.exec(wordmarkSvg)?.[1];
const markBox = /viewBox="([^"]+)"/.exec(wordmarkSvg)?.[1];
const [vx, vy, mvw, mvh] = markBox.split(/\s+/).map(Number);

await mkdir(OUT, { recursive: true });

// ── Background: field, mark above the clip, title and URL below ──────────────
const layers = [];
for (const b of FIELD) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="b" cx="${b.x * W}" cy="${b.y * H}" r="${b.r * W}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${esc(stops[b.i])}" stop-opacity="1"/>
    <stop offset="0.45" stop-color="${esc(stops[b.i])}" stop-opacity="0.4"/>
    <stop offset="1" stop-color="${esc(stops[b.i])}" stop-opacity="0"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#b)" opacity="${b.o}"/></svg>`;
  layers.push({ input: await raster(svg, W, H, 72), blend: "screen" });
}

const title = await fitText({ text: TITLE, targetWidth: W * 0.84, trackingEm: -0.01 });
const url = await fitText({ text: `OUT NOW  ·  ${SITE}`, weight: 700, targetWidth: W * 0.62, trackingEm: 0.08 });

// The square layout gives the clip 1080 rows, which leaves too little below it
// for a stack, so the title moves above the clip and only the URL stays under.
const square = FIT === "square";
const titleTop = square ? VY - title.height - 70 : VY + VH + 120;
const urlTop = square ? VY + VH + 46 : titleTop + title.height + 54;

const markW = W * 0.42;
const markH = markW / (mvw / mvh);
const mark = square
  ? ""
  : `<g transform="translate(${(W - markW) / 2} ${VY - markH - 110}) scale(${markH / mvh}) translate(${-vx} ${-vy})">
    <path d="${markPath}" fill="none" stroke="${FG}" stroke-opacity="0.9" stroke-width="7"
          stroke-linejoin="round" stroke-linecap="round"/>
  </g>`;

const chrome = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0.15" x2="1" y2="0.7">
${stops.map((s, i) => `    <stop offset="${((i / (stops.length - 1)) * 100).toFixed(1)}%" stop-color="${esc(s)}"/>`).join("\n")}
  </linearGradient></defs>
  ${mark}
  ${title.at((W - title.width) / 2, titleTop, "url(#g)")}
  ${url.at((W - url.width) / 2, urlTop, MUTED)}
</svg>`;
layers.push({ input: await raster(chrome, W, H, 216), blend: "over" });

const bgFile = path.join(os.tmpdir(), `ojinyx-clip-bg-${RECORD}.png`);
await writeFile(
  bgFile,
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite(layers)
    .png()
    .toBuffer(),
);

// ── Encode ───────────────────────────────────────────────────────────────────
const slug = TITLE.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const outFile = path.join(OUT, `${slug}-${START}s-${DURATION}s-${FIT}.mp4`);

const grade = LIFT ? "eq=brightness=0.04:contrast=1.08:saturation=1.06," : "";
// `crop=ih:ih` is centered by default, so the square fit takes the middle of
// the frame without hardcoding the source resolution.
const crop = square ? "crop=ih:ih," : "";
const filter =
  `[0:v]${crop}scale=${VW}:${VH}:flags=lanczos,${grade}setsar=1[v];` +
  `[1:v][v]overlay=0:${VY}:shortest=1,fps=${FPS},format=yuv420p[out]`;

await run(
  "ffmpeg",
  [
    "-nostdin", "-v", "error",
    "-ss", String(START), "-t", String(DURATION), "-i", VIDEO,
    "-loop", "1", "-i", bgFile,
    "-filter_complex", filter,
    "-map", "[out]", "-map", "0:a",
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-preset", "slow",
    "-crf", "18", "-maxrate", "12M", "-bufsize", "24M", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", "-shortest", "-y", outFile,
  ],
  { maxBuffer: 1 << 26 },
);

const bytes = statSync(outFile).size;
const { stdout } = await run("ffprobe", [
  "-v", "error", "-show_entries", "format=duration,bit_rate",
  "-show_entries", "stream=codec_name,width,height,r_frame_rate,sample_rate",
  "-of", "default=noprint_wrappers=1", outFile,
]);
const get = (k) => (stdout.match(new RegExp(`${k}=(.+)`)) || [])[1]?.trim();

console.log(`${path.relative(root, outFile)}`);
console.log(`  ${get("width")}x${get("height")}  ${FPS}fps  ${Number(get("duration")).toFixed(1)}s`);
console.log(`  ${(bytes / 1024 / 1024).toFixed(1)} MB  (Instagram's ceiling is 4096 MB — ${((bytes / (4096 * 1024 * 1024)) * 100).toFixed(2)}% of it)`);
console.log(`  ${(Number(get("bit_rate")) / 1e6).toFixed(1)} Mb/s, H.264 high, AAC 192k 48kHz, faststart`);
console.log(`  fit ${FIT}, grade ${LIFT ? "lifted (--lift)" : "untouched"}`);
