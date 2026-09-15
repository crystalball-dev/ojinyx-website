import type { ReactNode } from "react";
import type { Palette } from "@/lib/palette";
import { paletteVars } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Scopes a palette to everything rendered inside. */
export function ReleaseTheme({ palette, children, className }: { palette: Palette; children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-bg text-fg", className)} style={paletteVars(palette)}>
      {children}
    </div>
  );
}
