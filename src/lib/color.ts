/**
 * Pure color math (no dependencies). Shared by the server-side palette
 * extractor and anything that wants to reason about contrast.
 *
 * Everything works in OKLab/OKLCH, a perceptual space that keeps
 * lightness/chroma/hue independent so we can push colors around without
 * them turning to mud.
 */

export type RGB = readonly [number, number, number]; // 0–255 each
export interface OKLCH {
  l: number; // 0–1
  c: number; // 0–~0.4
  h: number; // degrees 0–360
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v: number): number {
  const c = clamp01(v);
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

/** Björn Ottosson's OKLab conversion. */
export function rgbToOklab(rgb: RGB): { L: number; a: number; b: number } {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function rgbToOklch(rgb: RGB): OKLCH {
  const { L, a, b } = rgbToOklab(rgb);
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

function inGamut([r, g, b]: [number, number, number]): boolean {
  const eps = 0.0005;
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps;
}

/**
 * OKLCH → sRGB with gamut mapping: if the requested chroma can't be shown
 * on screen we walk chroma down (keeping hue + lightness) until it fits.
 */
export function oklchToRgb(color: OKLCH): RGB {
  const l = clamp01(color.l);
  const hRad = (color.h * Math.PI) / 180;
  let c = Math.max(0, color.c);

  for (let i = 0; i < 24; i++) {
    const lin = oklabToLinearRgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
    if (inGamut(lin)) {
      return [linearToSrgb(lin[0]), linearToSrgb(lin[1]), linearToSrgb(lin[2])];
    }
    c *= 0.86;
  }
  const lin = oklabToLinearRgb(l, 0, 0);
  return [linearToSrgb(lin[0]), linearToSrgb(lin[1]), linearToSrgb(lin[2])];
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const oklchToHex = (c: OKLCH) => rgbToHex(oklchToRgb(c));

/** WCAG 2.x relative luminance. */
export function relativeLuminance(rgb: RGB): number {
  return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Shortest angular distance between two hues, 0–180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Nudge a color's lightness in one direction until it reaches the requested
 * contrast against `against` (or we run out of room). Chroma is preserved as
 * far as the gamut allows.
 */
export function ensureContrast(
  color: OKLCH,
  against: RGB,
  minRatio: number,
  direction: "lighter" | "darker",
): OKLCH {
  const step = direction === "lighter" ? 0.02 : -0.02;
  let current = { ...color };
  for (let i = 0; i < 50; i++) {
    if (contrastRatio(oklchToRgb(current), against) >= minRatio) return current;
    const nextL = current.l + step;
    if (nextL < 0 || nextL > 1) break;
    current = { ...current, l: nextL };
  }
  return current;
}

/** Pick black or white text for a given background. */
export function readableOn(bg: RGB): "#000000" | "#ffffff" {
  return contrastRatio(bg, [0, 0, 0]) >= contrastRatio(bg, [255, 255, 255]) ? "#000000" : "#ffffff";
}
