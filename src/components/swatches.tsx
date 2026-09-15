import type { Palette } from "@/lib/palette";

/** The raw quantized colours — a small, honest "here's where the theme came from". */
export function Swatches({ palette }: { palette: Palette }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 overflow-hidden rounded-full ring-1 ring-current/15">
        {palette.swatches.map((hex, i) => (
          <span key={`${hex}-${i}`} className="flex-1" style={{ background: hex }} title={hex} />
        ))}
      </div>
      <p className="label text-muted">
        {palette.source === "extracted"
          ? `${palette.mode} theme · ${palette.swatches.length} colours extracted from the artwork`
          : "artwork unavailable · brand palette in use"}
      </p>
    </div>
  );
}
