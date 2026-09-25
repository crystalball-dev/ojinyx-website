import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Unbounded } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { site } from "@/content/site";
import { safeJsonLd } from "@/lib/utils";
import "./globals.css";

// Both fonts are variable, latin-only, self-hosted by next/font at build:
// one file each, no request to Google from the browser, zero layout shift.
const display = Unbounded({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-display-family",
});

const body = Space_Grotesk({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-body-family",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#06020c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const musicGroupJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicGroup",
  name: site.name,
  url: site.url,
  genre: site.genres,
  email: site.email,
  description: site.bio.join(" "),
  memberOf: { "@type": "Organization", name: site.label, legalName: site.labelLegalName, url: site.labelUrl },
  sameAs: site.socials.map((s) => s.href),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="grain flex min-h-full flex-col">
        <Nav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(musicGroupJsonLd) }} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
