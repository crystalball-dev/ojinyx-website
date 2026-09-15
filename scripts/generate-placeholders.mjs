#!/usr/bin/env node
/**
 * Generates placeholder merch product shots (public/merch/*.jpg, 1200×1500)
 * so the merch page renders before real photos exist.
 *
 * Run: npm run placeholders
 * Delete once you have real product photography — nothing at runtime depends on it.
 * (Album artwork and the hero clip come from `npm run covers`, not from here.)
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = (...p) => path.join(root, ...p);

const grain = `
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.22"/></feComponentTransfer>
  </filter>`;
const grainRect = `<rect width="100%" height="100%" filter="url(#grain)" opacity="0.5"/>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${grain}</defs>${body}${grainRect}</svg>`;

const merch = {
  "tee-acid": svg(
    1200,
    1500,
    `<rect width="1200" height="1500" fill="#141414"/>
     <path d="M300 420 L470 300 Q600 380 730 300 L900 420 L850 640 L770 600 L770 1250 L430 1250 L430 600 L350 640 Z" fill="#0a0a0a" stroke="#c6ff00" stroke-width="10"/>
     <rect x="500" y="700" width="200" height="34" fill="#c6ff00"/>
     <rect x="500" y="760" width="120" height="34" fill="#c6ff00"/>`,
  ),
  "hoodie-black": svg(
    1200,
    1500,
    `<rect width="1200" height="1500" fill="#0b1040"/>
     <path d="M280 470 L460 330 Q600 240 740 330 L920 470 L870 700 L790 660 L790 1270 L410 1270 L410 660 L330 700 Z" fill="#121a52" stroke="#00f0ff" stroke-width="10"/>
     <path d="M470 330 Q600 200 730 330 Q600 420 470 330 Z" fill="#0b1040" stroke="#00f0ff" stroke-width="10"/>
     <circle cx="600" cy="900" r="110" fill="none" stroke="#00f0ff" stroke-width="18"/>`,
  ),
  "cap-pink": svg(
    1200,
    1500,
    `<rect width="1200" height="1500" fill="#ffe6f0"/>
     <path d="M300 800 Q300 480 600 480 Q900 480 900 800 Z" fill="#ff2bd6"/>
     <path d="M280 800 L1020 800 Q1040 900 900 900 L300 900 Q260 880 280 800 Z" fill="#0a0a0a"/>
     <rect x="560" y="600" width="80" height="80" fill="#fff7f0"/>`,
  ),
  "poster-set": svg(
    1200,
    1500,
    `<rect width="1200" height="1500" fill="#f4f4ec"/>
     <rect x="240" y="360" width="560" height="760" fill="#0b1040" transform="rotate(-6 520 740)"/>
     <rect x="330" y="330" width="560" height="760" fill="#06020c" transform="rotate(2 610 710)"/>
     <rect x="420" y="300" width="560" height="760" fill="#ff2bd6" transform="rotate(9 700 680)"/>
     <rect x="0" y="1300" width="1200" height="200" fill="#0a0a0a"/>`,
  ),
};

async function render(svgString, dest) {
  const buf = await sharp(Buffer.from(svgString), { density: 144 }).resize(1200, 1500).jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  console.log(`wrote ${path.relative(root, dest)} (${(buf.length / 1024).toFixed(0)} KB)`);
}

for (const [id, s] of Object.entries(merch)) await render(s, out("public", "merch", `${id}.jpg`));
