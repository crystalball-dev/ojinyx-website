#!/usr/bin/env node
/**
 * YouTube thumbnail, built from a frame of the video itself.
 *
 *   brand-art/thumbnails/<slug>-<time>s.png
 *
 * Run:
 *   npm run thumbnail -- --video "E:/.../SNOW WHITE.MP4" --time 183 --title "SNOW WHITE"
 *   npm run thumbnail -- --video "..." --time 53,131,183 --title "SNOW WHITE"
 *
 * ── Notes ─────────────────────────────────────────────────────────────────
 * 1920x1080. YouTube's floor is 1280x720 and its ceiling is a 2 MB file; this
 * sits above the floor so the image survives being re-encoded, and PNG-24 of a
 * video frame stays well inside the limit.
 *
 * The type block sits in the lower middle and stops short of the bottom-right,
 * where YouTube prints the duration badge, and short of the very bottom, where
 * the watched-progress bar is drawn over the image in feeds.
 *
 * Source frames from this record are extremely dark, so the frame gets a
 * measured lift rather than a guessed one: `autoLevel` reads the actual channel
 * maximum and scales to it, which brings the image up without inventing the
 * blown-out look a fixed brightness multiplier would give a frame that is
 * already bright.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);
const root = process.cwd();
const OUT = path.join(root, "brand-art", "thumbnails");
const FONT_DIR = path.join(root, "scripts", "fonts");

// fontconfig is read when the render library initializes — set it up first.
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
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const VIDEO = arg("video");
const TIMES = String(arg("time", "0"))
  .split(",")
  .map((t) => Number(t.trim()))
  .filter((t) => Number.isFinite(t) && t >= 0);
const TITLE = arg("title", "SNOW WHITE");
const RECORD = arg("record", "kingdoms");

if (!VIDEO) {
  console.error('Pass --video "<path to the mp4>".');
  process.exit(1);
}

const W = 1920;
const H = 1080;
const FG = "#f3eef7";
const DISPLAY = "Unbounded";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const raster = (svg, w, h, density = 144) =>
  sharp(Buffer.from(svg), { density, limitInputPixels: false })
    .resize({ width: Math.round(w), height: Math.round(h), fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

async function measure({ text, family, weight, size, tracking }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(size * (text.length + 4) * 1.4)}" height="${Math.ceil(size * 3)}">
  <text x="${size}" y="${size * 2}" font-family="${esc(family)}" font-weight="${weight}" font-size="${size}"
        letter-spacing="${tracking}" fill="#ffffff">${esc(text)}</text>
</svg>`;
  const out = await sharp(Buffer.from(svg), { density: 72 }).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  return {
    width: out.info.width,
    height: out.info.height,
    dx: -(out.info.trimOffsetLeft ?? 0) - size,
    dy: -(out.info.trimOffsetTop ?? 0) - size * 2,
  };
}

/** Same measure-then-scale approach as the title cards; librsvg has no metrics. */
async function fitText({ text, weight = 900, trackingEm = 0, targetWidth }) {
  const REF = 200;
  const ref = await measure({ text, family: DISPLAY, weight, size: REF, tracking: REF * trackingEm });
  const size = (REF * targetWidth) / ref.width;
  const tracking = size * trackingEm;
  const m = await measure({ text, family: DISPLAY, weight, size, tracking });
  return {
    width: m.width,
    height: m.height,
    at: (left, top, fill) =>
      `<text x="${left - m.dx}" y="${top - m.dy}" font-family="${esc(DISPLAY)}" font-weight="${weight}"
        font-size="${size}" letter-spacing="${tracking}" fill="${fill}">${esc(text)}</text>`,
  };
}

/**
 * Scale the frame so its brightest channel value reaches full, then lift
 * saturation a little. Read from the frame rather than applied blind, so a
 * bright frame is left alone and a near-black one is rescued.
 */
async function autoLevel(buf) {
  const { channels } = await sharp(buf).stats();
  const peak = Math.max(...channels.map((c) => c.max));
  const gain = peak > 0 ? Math.min(2.6, 255 / peak) : 1;
  return sharp(buf)
    .linear(gain, 0)
    .modulate({ saturation: 1.18, brightness: 1.04 })
    .toBuffer();
}

async function grabFrame(time) {
  const tmp = path.join(os.tmpdir(), `ojinyx-frame-${time}.png`);
  await run("ffmpeg", ["-nostdin", "-v", "error", "-ss", String(time), "-i", VIDEO, "-frames:v", "1", "-y", tmp]);
  return readFile(tmp);
}

const wordmarkSvg = await readFile(path.join(root, "public", "brand", "wordmark.svg"), "utf8");
const markPath = /<path[^>]*\sd="([^"]+)"/.exec(wordmarkSvg)?.[1];
const markBox = /viewBox="([^"]+)"/.exec(wordmarkSvg)?.[1];
const gradients = JSON.parse(await readFile(path.join(root, "src", "content", "mark-gradients.generated.json"), "utf8"));
const stops = gradients[RECORD] ?? gradients.kingdoms;

await mkdir(OUT, { recursive: true });

const slug = TITLE.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

for (const time of TIMES) {
  const frame = await autoLevel(await grabFrame(time));
  const base = await sharp(frame).resize(W, H, { fit: "cover", position: "center" }).toBuffer();

  // Scrim: transparent at the top, dark across the lower half, so type reads
  // whatever the frame is doing underneath it.
  const scrim = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#06020c" stop-opacity="0"/>
    <stop offset="42%" stop-color="#06020c" stop-opacity="0.12"/>
    <stop offset="72%" stop-color="#06020c" stop-opacity="0.72"/>
    <stop offset="100%" stop-color="#06020c" stop-opacity="0.93"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#s)"/>
</svg>`;

  const title = await fitText({ text: TITLE, targetWidth: W * 0.78, trackingEm: -0.01 });
  const [vx, vy, vw, vh] = markBox.split(/\s+/).map(Number);
  const markW = W * 0.19;
  const markH = markW / (vw / vh);

  // Bottom of the type block clears the progress bar; the badge lives bottom-right.
  const titleTop = H - H * 0.14 - title.height;
  const markTop = titleTop - markH - H * 0.045;

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0.15" x2="1" y2="0.7">
${stops.map((s, i) => `    <stop offset="${((i / (stops.length - 1)) * 100).toFixed(1)}%" stop-color="${esc(s)}"/>`).join("\n")}
  </linearGradient></defs>
  <g transform="translate(${(W - markW) / 2} ${markTop}) scale(${markH / vh}) translate(${-vx} ${-vy})">
    <path d="${markPath}" fill="none" stroke="${FG}" stroke-opacity="0.92" stroke-width="7"
          stroke-linejoin="round" stroke-linecap="round"/>
  </g>
  ${title.at((W - title.width) / 2, titleTop, "url(#g)")}
</svg>`;

  const out = await sharp(base)
    .composite([{ input: await raster(scrim, W, H, 72) }, { input: await raster(overlay, W, H, 216) }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const file = path.join(OUT, `${slug}-${time}s.png`);
  await writeFile(file, out);
  console.log(`${path.relative(root, file).padEnd(46)} ${W}x${H}  ${(out.length / 1024 / 1024).toFixed(2)} MB`);
}

console.log(`\nwrote ${TIMES.length} thumbnail${TIMES.length === 1 ? "" : "s"} to ${path.relative(root, OUT)}/`);
