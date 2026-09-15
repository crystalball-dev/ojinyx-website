import type { CSSProperties } from "react";
import type { Palette } from "./palette";

/**
 * Turn a palette into inline CSS custom properties. Anything rendered inside
 * an element carrying these vars re-themes automatically (Tailwind's
 * bg-bg / text-accent / etc. all resolve to the same variables).
 */
export function paletteVars(palette: Palette): CSSProperties {
  return {
    "--bg": palette.bg,
    "--fg": palette.fg,
    "--muted": palette.muted,
    "--accent": palette.accent,
    "--accent-fg": palette.accentFg,
    "--accent-2": palette.accent2,
    "--accent-3": palette.accent3,
    "--accent-4": palette.accent2,
    "--blob-blend": palette.mode === "light" ? "multiply" : "screen",
    colorScheme: palette.mode,
  } as CSSProperties;
}
