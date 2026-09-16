import { ImageResponse } from "next/og";
import { WORDMARK_PATH, WORDMARK_RATIO, WORDMARK_VIEWBOX } from "@/brand/wordmark";
import { site } from "@/content/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Site-wide social card: the blackletter wordmark over brand color. */
export default function Image() {
  const markWidth = 900;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          background: "#06020c",
          color: "#ffffff",
          fontFamily: "Geist, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: -140, top: -220, width: 640, height: 640, borderRadius: 9999, background: "#5b3dff", opacity: 0.75 }} />
        <div style={{ position: "absolute", right: -160, top: -60, width: 560, height: 560, borderRadius: 9999, background: "#ff2bd6", opacity: 0.7 }} />
        <div style={{ position: "absolute", right: 260, bottom: -320, width: 620, height: 620, borderRadius: 9999, background: "#ff4a1f", opacity: 0.55 }} />
        <svg viewBox={WORDMARK_VIEWBOX} width={markWidth} height={markWidth / WORDMARK_RATIO}>
          <path d={WORDMARK_PATH} fill="#ffffff" />
        </svg>
        <div style={{ display: "flex", fontSize: 36, opacity: 0.9 }}>{site.tagline}</div>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 8, color: "#ff2bd6", fontWeight: 700 }}>{site.label}</div>
      </div>
    ),
    { ...size },
  );
}
