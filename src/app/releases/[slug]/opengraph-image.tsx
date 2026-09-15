import { ImageResponse } from "next/og";
import { WORDMARK_PATH, WORDMARK_RATIO, WORDMARK_VIEWBOX } from "@/brand/wordmark";
import { site } from "@/content/site";
import { getCoverMedia } from "@/lib/covers";
import { getCoverDataUrl, getCoverTheme } from "@/lib/palette";
import { RELEASE_TYPE_LABEL, formatReleaseDate, getRelease, sortedReleases } from "@/lib/releases";

export const alt = `Release by ${site.name}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return sortedReleases.map((r) => ({ slug: r.slug }));
}

/**
 * Social card generated from the release's own palette + artwork poster.
 * Rendered at build; falls back to a text-only card if the poster can't be read.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const release = getRelease(slug);
  const title = release?.title ?? site.name;
  const poster = release ? getCoverMedia(release).poster : undefined;
  const [{ palette }, coverSrc] = await Promise.all([getCoverTheme(poster, slug), getCoverDataUrl(poster, 560)]);

  const subtitle = release
    ? `${RELEASE_TYPE_LABEL[release.type]} · ${release.releaseDate ? formatReleaseDate(release.releaseDate) : "Coming soon"}`
    : site.tagline;

  const markWidth = 220;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: palette.bg,
          color: palette.fg,
          fontFamily: "Geist, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", right: -120, top: -160, width: 520, height: 520, borderRadius: 9999, background: palette.accent2, opacity: 0.55 }} />
        <div style={{ position: "absolute", left: -160, bottom: -220, width: 560, height: 560, borderRadius: 9999, background: palette.accent3, opacity: 0.45 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 56, padding: "56px 64px", width: "100%" }}>
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              width={518}
              height={518}
              alt=""
              style={{ width: 518, height: 518, objectFit: "cover", transform: "rotate(-3deg)", boxShadow: `18px 18px 0 ${palette.accent}` }}
            />
          ) : (
            <div style={{ width: 518, height: 518, display: "flex", background: palette.accent, transform: "rotate(-3deg)" }} />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minWidth: 0 }}>
            <svg viewBox={WORDMARK_VIEWBOX} width={markWidth} height={markWidth / WORDMARK_RATIO}>
              <path d={WORDMARK_PATH} fill={palette.fg} />
            </svg>
            <div
              style={{
                display: "flex",
                fontSize: title.length > 14 ? 72 : 96,
                fontWeight: 800,
                lineHeight: 0.95,
                letterSpacing: -3,
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: palette.muted }}>{subtitle}</div>
            <div
              style={{
                display: "flex",
                marginTop: 12,
                padding: "14px 28px",
                borderRadius: 9999,
                background: palette.accent,
                color: palette.accentFg,
                fontSize: 24,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 3,
                alignSelf: "flex-start",
              }}
            >
              {release?.releaseDate ? "Listen now" : "Coming soon"}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
