#!/usr/bin/env node
/**
 * Imports finished animated covers from the (git-ignored) _ANIMATIONS folder
 * into web-ready assets under /public, plus a manifest the site reads at build.
 *
 *   _ANIMATIONS/<ALBUM>/DONE/*.mp4  →  public/covers/<slug>.<hash>.mp4      1080² H.264, audio kept
 *                                      public/covers/<slug>.<hash>.webm     VP9 — only kept if clearly smaller
 *                                      public/covers/<slug>-sm.<hash>.mp4   540² H.264, silent (cards)
 *                                      public/covers/<slug>.<hash>.jpg      poster frame (palette + OG + fallback)
 *   _ANIMATIONS/MAIN/DONE/*.mp4     →  public/brand/hero.<hash>.{mp4,webm,jpg} + hero-sm  (900² profile)
 *   manifest                         →  src/content/covers.generated.json
 *
 * <hash> is derived from the source file, so filenames change whenever the
 * clip changes and everything can be cached immutably. Old variants are
 * removed. The newest .mp4 in each DONE folder wins. A DONE/poster.{jpg,png}
 * file, if present, is used as the poster instead of a frame from the clip.
 * Pass --force to re-encode even when outputs already exist.
 *
 * Needs ffmpeg + ffprobe: on PATH, or via FFMPEG_PATH / FFPROBE_PATH, or
 * `npm i -D ffmpeg-static ffprobe-static` (picked up automatically).
 *
 * Run: npm run covers
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = process.cwd();
const SRC = path.join(root, "_ANIMATIONS");
const COVERS = path.join(root, "public", "covers");
const BRAND = path.join(root, "public", "brand");
const MANIFEST = path.join(root, "src", "content", "covers.generated.json");
const force = process.argv.includes("--force");

const PROFILES = {
  // Cover art is the point of a release page, so keep it close to the master.
  cover: { size: 1080, crf: 22, smallCrf: 26 },
  // The hero is the first thing anyone sees and its source is full of fine
  // vertical grain, which is exactly what a high CRF smears into mush. Encode
  // at native resolution and spend the bytes; phones still get the 540²
  // variant. Raise `crf` if the file needs to be smaller — 25 costs about
  // 2 MB less and is still far sharper than the 900²/27 this replaced.
  hero: { size: 1080, crf: 23, smallCrf: 26 },
};

/**
 * Artwork folders are named after the image, not always the record. Map any
 * that differ to the release slug in src/content/releases.ts.
 */
const ALBUM_SLUGS = {
  BUNNY: "the-hills", // the rabbit artwork is THE HILLS EP, after its lead track
};

// ---------------------------------------------------------------------------
// tooling

function resolveTool(name, envKey, staticPkg) {
  if (process.env[envKey]) return process.env[envKey];
  try {
    const p = require(staticPkg);
    const resolved = typeof p === "string" ? p : p?.path;
    if (resolved && existsSync(resolved)) return resolved;
  } catch {
    /* not installed */
  }
  return name;
}

const FFMPEG = resolveTool("ffmpeg", "FFMPEG_PATH", "ffmpeg-static");
const FFPROBE = resolveTool("ffprobe", "FFPROBE_PATH", "ffprobe-static");

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "pipe"] });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => (out += d));
    child.stderr?.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(cmd)} exited ${code}: ${err.slice(-600)}`))));
  });
}

async function assertTools() {
  try {
    await run(FFMPEG, ["-version"], { capture: true });
    await run(FFPROBE, ["-version"], { capture: true });
  } catch {
    console.error(
      "ffmpeg/ffprobe not found. Install ffmpeg (winget install ffmpeg / brew install ffmpeg), set FFMPEG_PATH + FFPROBE_PATH, or run: npm i -D ffmpeg-static ffprobe-static",
    );
    process.exit(1);
  }
}

async function probe(file) {
  const json = JSON.parse(await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { capture: true }));
  const video = json.streams.find((s) => s.codec_type === "video");
  const audio = json.streams.find((s) => s.codec_type === "audio");
  return { width: video?.width ?? 0, height: video?.height ?? 0, duration: Number(json.format?.duration ?? 0), hasAudio: Boolean(audio) };
}

// ---------------------------------------------------------------------------
// helpers

// Folder name → URL slug. Accented and Nordic letters are transliterated
// rather than dropped, so a folder named "KINGDØMS" still lands on
// /releases/kingdoms instead of /releases/kingdms.
const TRANSLITERATE = { "ø": "o", "æ": "ae", "å": "a", "ß": "ss", "đ": "d", "ł": "l" };

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[øæåßđł]/g, (c) => TRANSLITERATE[c] ?? c)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");

async function newestMp4(dir) {
  const files = (await readdir(dir)).filter((f) => /\.mp4$/i.test(f) && !f.startsWith("."));
  if (!files.length) return null;
  const withTime = await Promise.all(files.map(async (f) => ({ f, mtime: (await stat(path.join(dir, f))).mtimeMs })));
  withTime.sort((a, b) => b.mtime - a.mtime);
  return path.join(dir, withTime[0].f);
}

async function findPosterOverride(doneDir) {
  for (const name of ["poster.jpg", "poster.jpeg", "poster.png"]) {
    const p = path.join(doneDir, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

async function hashFiles(...files) {
  const h = createHash("sha1");
  for (const f of files) if (f) h.update(await readFile(f));
  return h.digest("hex").slice(0, 8);
}

const exists = async (f) => !force && existsSync(f) && (await stat(f)).size > 0;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const toPublic = (f) => "/" + path.relative(path.join(root, "public"), f).split(path.sep).join("/");

// Square-fit filter: covers are meant to be square; letterbox anything else.
const squareFilter = (size, { fps = true } = {}) =>
  `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:black,setsar=1${fps ? ",fps=30" : ""}`;

async function removeStale(dir, slug, hash) {
  const pattern = new RegExp(`^${slug}(-sm)?(\\.[0-9a-f]{8})?\\.(mp4|webm|jpg)$`);
  for (const f of await readdir(dir)) {
    const m = pattern.exec(f);
    if (m && m[2] !== `.${hash}`) {
      await unlink(path.join(dir, f));
      console.log(`  removed stale ${f}`);
    }
  }
}

async function encode(source, dir, slug, profile, posterOverride, previous) {
  const info = await probe(source);
  const hash = await hashFiles(source, posterOverride);
  await removeStale(dir, slug, hash);

  const base = path.join(dir, `${slug}.${hash}`);
  const smallBase = path.join(dir, `${slug}-sm.${hash}`);
  const audioAac = info.hasAudio ? ["-c:a", "aac", "-b:a", "96k", "-ac", "2"] : ["-an"];
  const audioOpus = info.hasAudio ? ["-c:a", "libopus", "-b:a", "64k", "-ac", "2"] : ["-an"];
  const out = {};

  out.mp4 = `${base}.mp4`;
  if (!(await exists(out.mp4))) {
    console.log(`  encoding ${path.basename(out.mp4)} (H.264 ${profile.size}²)…`);
    await run(FFMPEG, [
      "-y", "-v", "error", "-i", source, "-vf", squareFilter(profile.size),
      "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-preset", "slow", "-crf", String(profile.crf),
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", ...audioAac, out.mp4,
    ]);
  }

  const webm = `${base}.webm`;
  const webmDroppedBefore = !force && previous?.hash === hash && previous.webm === undefined;
  if (!(await exists(webm)) && !webmDroppedBefore) {
    console.log(`  encoding ${path.basename(webm)} (VP9 ${profile.size}²)…`);
    await run(FFMPEG, [
      "-y", "-v", "error", "-i", source, "-vf", squareFilter(profile.size),
      "-c:v", "libvpx-vp9", "-crf", String(profile.crf + 9), "-b:v", "0", "-deadline", "good", "-cpu-used", "3", "-row-mt", "1",
      "-pix_fmt", "yuv420p", ...audioOpus, webm,
    ]);
    // Keep WebM only when it is clearly smaller; otherwise it just costs bytes in the repo.
    const [m, w] = await Promise.all([stat(out.mp4), stat(webm)]);
    if (w.size > m.size * 0.85) {
      await unlink(webm);
      console.log(`  webm dropped (${kb(w.size)} vs mp4 ${kb(m.size)})`);
    }
  }
  if (existsSync(webm)) out.webm = webm;

  out.mp4Small = `${smallBase}.mp4`;
  if (!(await exists(out.mp4Small))) {
    console.log(`  encoding ${path.basename(out.mp4Small)} (H.264 540², silent)…`);
    await run(FFMPEG, [
      "-y", "-v", "error", "-i", source, "-vf", squareFilter(540),
      "-c:v", "libx264", "-profile:v", "main", "-preset", "slow", "-crf", String(profile.smallCrf),
      "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out.mp4Small,
    ]);
  }

  out.poster = `${base}.jpg`;
  if (!(await exists(out.poster))) {
    const filter = squareFilter(profile.size, { fps: false });
    if (posterOverride) {
      console.log(`  poster from ${path.basename(posterOverride)}`);
      await run(FFMPEG, ["-y", "-v", "error", "-i", posterOverride, "-vf", filter, "-frames:v", "1", "-q:v", "2", out.poster]);
    } else {
      const t = Math.max(0, info.duration * 0.5).toFixed(2);
      console.log(`  poster frame at ${t}s`);
      await run(FFMPEG, ["-y", "-v", "error", "-ss", t, "-i", source, "-vf", filter, "-frames:v", "1", "-q:v", "2", out.poster]);
    }
  }

  const bytes = Object.fromEntries(await Promise.all(Object.entries(out).map(async ([k, f]) => [k, (await stat(f)).size])));
  return {
    source: path.relative(root, source).split(path.sep).join("/"),
    hash,
    width: info.width,
    height: info.height,
    duration: Number(info.duration.toFixed(2)),
    hasAudio: info.hasAudio,
    poster: toPublic(out.poster),
    mp4: toPublic(out.mp4),
    webm: out.webm ? toPublic(out.webm) : undefined,
    mp4Small: toPublic(out.mp4Small),
    bytes,
  };
}

// ---------------------------------------------------------------------------
// main

await assertTools();
if (!existsSync(SRC)) {
  console.error(`No ${path.relative(root, SRC)} folder found — nothing to import.`);
  process.exit(1);
}
await mkdir(COVERS, { recursive: true });
await mkdir(BRAND, { recursive: true });

let manifest = { generatedAt: "", hero: null, covers: {} };
try {
  manifest = { ...manifest, ...JSON.parse(await readFile(MANIFEST, "utf8")) };
} catch {
  /* first run */
}

const albums = (await readdir(SRC, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);

for (const album of albums) {
  const doneDir = path.join(SRC, album, "DONE");
  if (!existsSync(doneDir)) {
    console.log(`- ${album}: no DONE folder, skipped`);
    continue;
  }
  const source = await newestMp4(doneDir);
  if (!source) {
    console.log(`- ${album}: DONE folder has no .mp4, skipped`);
    continue;
  }
  const isHero = album.toUpperCase() === "MAIN";
  const slug = isHero ? "hero" : (ALBUM_SLUGS[album.toUpperCase()] ?? slugify(album));
  console.log(`- ${album} → ${isHero ? "brand/hero" : `covers/${slug}`}  (${path.basename(source)})`);
  const previous = isHero ? manifest.hero : manifest.covers[slug];
  const entry = await encode(source, isHero ? BRAND : COVERS, slug, isHero ? PROFILES.hero : PROFILES.cover, await findPosterOverride(doneDir), previous);
  if (isHero) manifest.hero = entry;
  else manifest.covers[slug] = entry;
  console.log(`  ${Object.entries(entry.bytes).map(([k, v]) => `${k} ${kb(v)}`).join(" · ")}`);
}

manifest.generatedAt = new Date().toISOString();
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nwrote ${path.relative(root, MANIFEST)} — ${Object.keys(manifest.covers).length} cover(s)${manifest.hero ? " + hero" : ""}`);
