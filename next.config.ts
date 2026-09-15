import type { NextConfig } from "next";

const ONE_YEAR = 60 * 60 * 24 * 365;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // AVIF first (≈20% smaller), WebP fallback. Both cached by the Vercel image CDN.
    formats: ["image/avif", "image/webp"],
    // Covers are content-addressed by filename, so optimized variants can live for a month.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // Only the default quality (75) is allowed — keeps the optimizer cache small.
    qualities: [75],
    remotePatterns: [
      // Add a host here if cover/merch images are served from a CDN, e.g.
      // { protocol: "https", hostname: "cdn.ojinyx.com" },
    ],
  },

  // Palette extraction + OG images read covers from /public at render time.
  // Static pages don't need this, but it keeps ISR/on-demand renders safe.
  outputFileTracingIncludes: {
    "/": ["./public/brand/*.jpg"],
    "/releases/[slug]": ["./public/covers/*.jpg"],
    "/releases/[slug]/opengraph-image": ["./public/covers/*.jpg"],
  },

  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ];
    const immutable = [{ key: "Cache-Control", value: `public, max-age=${ONE_YEAR}, immutable` }];
    return [
      { source: "/:path*", headers: security },
      // Covers and the hero clip carry a content hash in their filename (see scripts/import-covers.mjs).
      { source: "/covers/:path*", headers: immutable },
      { source: "/brand/:path*", headers: immutable },
      { source: "/merch/:path*", headers: immutable },
    ];
  },
};

export default nextConfig;
