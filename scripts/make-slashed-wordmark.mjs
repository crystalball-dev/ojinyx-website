#!/usr/bin/env node
/**
 * The ojinyx line wordmark with the o slashed — ø — in the same face.
 *
 *   brand-art/wordmark-slashed.svg        vector master
 *   brand-art/wordmark-slashed.png        line art, transparent
 *   brand-art/wordmark-slashed-solid.png  filled, transparent
 *   brand-art/wordmark-slashed-check.png  before and after, side by side
 *
 * Run: npm run slashed  [-- --angle 56 --thickness 8.4 --overshoot 1.12]
 *
 * ── How the slash is derived ──────────────────────────────────────────────
 * Nothing here is invented. The wordmark already contains two diagonal bars —
 * the accents over the i's — and they are the only straight strokes in the
 * face, so they define what a bar looks like in it. The script measures one
 * and copies its construction:
 *
 *   • thickness is read off the accent, perpendicular to its own axis
 *   • the ends are cut square to the axis, which is how the accent's top
 *     end is cut (its bottom end is rounded; a slash wants two cut ends)
 *
 * The angle comes from the o rather than the accent. The accents sit at about
 * 64° because they are tick marks; a slash is a diagonal, so it follows the
 * o's own corner-to-corner diagonal and lands near 56°. That keeps it inside
 * the family without looking like a tick mark that wandered down.
 *
 * Everything is measured from the path at run time, so if the wordmark is ever
 * redrawn the slash re-derives rather than drifting out of register.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const OUT = path.join(root, "brand-art");
const SRC = path.join(root, "public", "brand", "wordmark.svg");

const args = process.argv.slice(2);
const arg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : d;
};
/** Degrees above horizontal. Null means "use the o's own diagonal". */
const ANGLE = args.includes("--angle") ? arg("angle", 56) : null;
/** Bar thickness in viewBox units. Null means "match the i accents". */
const THICKNESS = args.includes("--thickness") ? arg("thickness", 8.4) : null;
/** How far past the bowl outline the slash runs, as a fraction of its height. */
const OVERSHOOT = arg("overshoot", 0.11);
/** Stroke weight for the line-art render, in viewBox units. */
const STROKE = arg("stroke", 1.6);

const svg = await readFile(SRC, "utf8");
const d = /<path[^>]*\sd="([^"]+)"/.exec(svg)?.[1];
const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
if (!d || !viewBox) {
  console.error("Could not read the wordmark path.");
  process.exit(1);
}

// ── Measure the existing path ────────────────────────────────────────────────

const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

/** Flatten a subpath to points, sampling curves so bounds are real, not hull-based. */
function points(sub) {
  const toks = sub.match(/[MLCZ]|-?[\d.]+/gi) ?? [];
  const out = [];
  let i = 0;
  let cmd = null;
  let cur = [0, 0];
  while (i < toks.length) {
    if (/^[MLCZ]$/i.test(toks[i])) {
      cmd = toks[i].toUpperCase();
      i++;
      continue;
    }
    if (cmd === "M" || cmd === "L") {
      cur = [+toks[i], +toks[i + 1]];
      out.push(cur);
      i += 2;
    } else if (cmd === "C") {
      const p1 = [+toks[i], +toks[i + 1]];
      const p2 = [+toks[i + 2], +toks[i + 3]];
      const p3 = [+toks[i + 4], +toks[i + 5]];
      for (let t = 0.05; t <= 1.0001; t += 0.05) out.push(bezier(cur, p1, p2, p3, t));
      cur = p3;
      i += 6;
    } else i++;
  }
  return out;
}

const subs = d.split(/(?=M)/).map((s) => s.trim()).filter(Boolean);
const boxes = subs.map((s) => {
  const P = points(s);
  const xs = P.map((p) => p[0]);
  const ys = P.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), P };
});

// The o's bowl is the leftmost outer subpath; its counter sits inside it.
const bowlIdx = boxes.map((b, i) => ({ b, i })).filter((o) => o.b.y1 - o.b.y0 > 60).sort((a, z) => a.b.x0 - z.b.x0)[0].i;
const bowl = boxes[bowlIdx];

/**
 * Thickness of an accent bar, measured perpendicular to its own long axis.
 * The accents are the two short subpaths above the baseline.
 */
function accentThickness() {
  const accents = boxes.filter((b) => b.y1 < bowl.y0 + 5);
  if (!accents.length) return 8.4;
  const P = accents[0].P;
  // Minimum width across all directions. For a long thin bar that minimum IS
  // the bar's thickness. Measuring perpendicular to a "longest axis" instead
  // picks up the end caps and reads nearly twice as thick.
  let min = Infinity;
  for (let deg = 0; deg < 180; deg += 0.5) {
    const r = (deg * Math.PI) / 180;
    const nx = Math.cos(r);
    const ny = Math.sin(r);
    const proj = P.map((q) => q[0] * nx + q[1] * ny);
    min = Math.min(min, Math.max(...proj) - Math.min(...proj));
  }
  return min;
}

/**
 * Where the slash axis actually leaves the bowl, as a distance from centre.
 * The o is a hexagon, so its bounding-box diagonal runs well outside the
 * outline — sizing the slash off that made it hang past the baseline.
 */
function bowlReach(ux, uy) {
  const P = bowl.P;
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    // Does segment a-b cross the infinite line through (cx, cy) along u?
    const perp = (q) => (q[0] - cx) * -uy + (q[1] - cy) * ux;
    const pa = perp(a);
    const pb = perp(b);
    if (pa === pb || pa * pb > 0) continue;
    const t = pa / (pa - pb);
    const ix = a[0] + (b[0] - a[0]) * t;
    const iy = a[1] + (b[1] - a[1]) * t;
    const along = (ix - cx) * ux + (iy - cy) * uy;
    if (along > pos) pos = along;
    if (along < neg) neg = along;
  }
  return { pos, neg };
}

const bw = bowl.x1 - bowl.x0;
const bh = bowl.y1 - bowl.y0;
const cx = (bowl.x0 + bowl.x1) / 2;
const cy = (bowl.y0 + bowl.y1) / 2;
const thickness = THICKNESS ?? accentThickness();
const angle = ANGLE ?? (Math.atan2(bh, bw) * 180) / Math.PI;

// ── Build the slash ──────────────────────────────────────────────────────────
const rad = (angle * Math.PI) / 180;
// Lower-left to upper-right: x grows, y shrinks (SVG y points down).
const ux = Math.cos(rad);
const uy = -Math.sin(rad);
const nx = -uy;
const ny = ux;
const reach = bowlReach(ux, uy);
const over = bh * OVERSHOOT;
const t = thickness / 2;

const corner = (su, sn) => {
  const along = su > 0 ? reach.pos + over : reach.neg - over;
  return [cx + ux * along + nx * t * sn, cy + uy * along + ny * t * sn];
};
const [a1, a2, a3, a4] = [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)];
const f = (p) => `${p[0].toFixed(3)} ${p[1].toFixed(3)}`;
const slash = `M ${f(a1)} L ${f(a2)} L ${f(a3)} L ${f(a4)} Z`;


// ── Write the vector master ──────────────────────────────────────────────────
await mkdir(OUT, { recursive: true });
/**
 * Two elements, not one path, and it has to be this way.
 *
 * The wordmark's counters are wound the same direction as their outers, so the
 * path only fills correctly under `evenodd` — worth knowing on its own, since
 * under the default `nonzero` the o fills in as a solid hexagon. But evenodd
 * toggles on every overlap, so a slash merged into that path would punch holes
 * through the o wherever it crossed the stroke instead of sitting on top of it.
 *
 * Unioning them properly is a boolean path operation, which needs a geometry
 * library this repo does not carry. Keeping the slash as its own element gets
 * the same result for both uses: stroked, the two outlines simply overlap the
 * way line art does; filled, the bar paints over the letter.
 */
const master = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor" role="img" aria-label="ojinyx">
  <title>ojinyx — slashed o</title>
  <path d="${d}" fill-rule="evenodd"/>
  <path d="${slash}"/>
</svg>
`;
await writeFile(path.join(OUT, "wordmark-slashed.svg"), master);

// ── Renders ──────────────────────────────────────────────────────────────────
const [vx, vy, vw, vh] = viewBox.split(/\s+/).map(Number);
const pad = STROKE * 2;
const box = [vx - pad, vy - pad, vw + pad * 2, vh + pad * 2].join(" ");
const W = 2600;
const H = Math.round((W * (vh + pad * 2)) / (vw + pad * 2));

const render = (paint, withSlash = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${W}" height="${H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0.55">
    <stop offset="0%" stop-color="#199efb"/><stop offset="55%" stop-color="#5c36f9"/><stop offset="100%" stop-color="#c41ffa"/>
  </linearGradient></defs>
  <path d="${d}" fill-rule="evenodd" ${paint}/>
  ${withSlash ? `<path d="${slash}" ${paint}/>` : ""}
</svg>`;

const raster = (s) => sharp(Buffer.from(s), { density: 216, limitInputPixels: false }).resize(W, H, { fit: "fill", kernel: "lanczos3" }).png({ compressionLevel: 9 });

await raster(render(`fill="none" stroke="url(#g)" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"`)).toFile(path.join(OUT, "wordmark-slashed.png"));

await raster(render(`fill="url(#g)"`)).toFile(path.join(OUT, "wordmark-slashed-solid.png"));

// Before and after, on white, so the change is the only thing that moves.
const before = await raster(render(`fill="none" stroke="url(#g)" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"`, false)).toBuffer();
const after = await raster(render(`fill="none" stroke="url(#g)" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"`)).toBuffer();
const gap = 26;
await sharp({ create: { width: W + gap * 2, height: H * 2 + gap * 3, channels: 4, background: "#ffffff" } })
  .composite([
    { input: before, left: gap, top: gap },
    { input: after, left: gap, top: H + gap * 2 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "wordmark-slashed-check.png"));

console.log(`o bowl      ${bw.toFixed(1)} x ${bh.toFixed(1)} at (${bowl.x0.toFixed(1)}, ${bowl.y0.toFixed(1)})`);
console.log(`thickness   ${thickness.toFixed(2)} ${THICKNESS ? "(given)" : "(measured off the i accents)"}`);
console.log(`angle       ${angle.toFixed(1)}° ${ANGLE ? "(given)" : "(the bowl's diagonal)"}`);
console.log(`overshoot   ${(bh * OVERSHOOT).toFixed(1)} units past the outline each end`);
console.log(`\nwrote 4 files to ${path.relative(root, OUT)}/`);
