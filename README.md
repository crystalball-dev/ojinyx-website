# ojinyx — artist site

Personal music project site for **ojinyx**, released through **OPERATION FAIRWAY**. Next.js 16 (App Router), deployed on Vercel at the custom domain.
Loud on the surface, boring underneath: static pages, compositor-only animation, one native module at build time.

## House style

Three rules, applied everywhere:

| Rule | Example |
| --- | --- |
| The artist name is **always lowercase** | `ojinyx` |
| Record and song titles are **always allcaps** | `KINGDOMS`, `WAR ON DRUGS`, `THE HILLS` |
| Everything is released through **OPERATION FAIRWAY** | shown on every release page, the home page and the footer |

The CSS does not force a case anywhere, so what you type in `src/content/` is what renders. `npm run dev` prints a console warning if a release or track title breaks the allcaps rule, or if the artist name stops being lowercase. The imprint comes from `site.label` and is applied to every release automatically; set `label` on a release only if it came out somewhere else.

## Stack and why

| Concern | Choice | Reason |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router, Turbopack) | First-class on Vercel: static generation, image CDN, ISR, OG image generation, all zero-config. |
| Styling | **Tailwind CSS 4** + a few `@utility` rules | Tiny CSS output; the whole theme is CSS custom properties, so re-theming a page is one inline `style`. |
| Motion | **No animation library.** CSS keyframes/transitions plus two small hooks (IntersectionObserver reveals, rAF pointer tilt) | Motion was in the first cut for the mobile menu and the tilt cards only; measured at 44 KB gzipped, a fifth of the page's JavaScript, for two interactions. Everything ambient (blobs, marquee, hero entrance, scroll-driven parallax, reveals) runs on the compositor and costs zero JS on an idle page. If richer choreography is ever needed, `motion/react` with `LazyMotion` drops back in cleanly. |
| Page transitions | React `<ViewTransition>` | Album covers morph from grid → release page using the browser View Transitions API. No library, degrades to an instant swap. |
| Audio | Native `<audio>` for previews; SoundCloud's official widget behind a click-to-load facade | No audio library needed. The SoundCloud iframe (~1 MB of third-party JS) only loads after a tap, never on first paint. |
| Colour extraction | **sharp** (already a Next.js dependency) + a small median-cut quantizer + OKLCH maths in `src/lib` | Runs once per release at build time on the poster frame. No client-side extraction, no extra runtime dependency. |
| Animated covers | **ffmpeg** at import time (`npm run covers`), native `<video>` at runtime | Finished clips in `_ANIMATIONS/<ALBUM>/DONE` become H.264 (+ VP9 when it's smaller) at 1080² plus a silent 540² card variant and a poster frame. The poster paints first; the clip fades in when it can play, on hover/in-view for cards, autoplay for heroes. Reduced motion and data-saver get the poster only. |
| Brand mark | Vectorised blackletter wordmark (`src/brand/wordmark.ts`, `public/brand/wordmark.svg`) | Inline SVG inherits `currentColor`, so it works inside the difference-blended nav, on themed pages, and in OG cards. Favicon and apple icon are the initial glyph. |
| Fonts | `next/font/google`: **Unbounded** (display) + **Space Grotesk** (body), both variable | Self-hosted at build, one file each, `font-display: swap`, no request to Google from the browser. |
| Analytics | `@vercel/analytics` + `@vercel/speed-insights` | No-ops locally; real-user Core Web Vitals in production. |

No WebGL, no canvas loops, no scroll-jacking. Every continuous animation touches only `transform`/`opacity`.

## Artwork pipeline: `_ANIMATIONS` → site

Source clips live in `_ANIMATIONS/` (git-ignored, 100+ MB). The convention:

```
_ANIMATIONS/
  MAIN/DONE/main_ojinyx.mp4          → home page hero clip
  KINGDOMS/DONE/kingdoms_ojinyx.mp4  → /releases/kingdoms
  WAR ON DRUGS/DONE/*.mp4            → /releases/war-on-drugs   (folder name is slugified)
  <ALBUM>/DONE/poster.jpg            → optional: use this still instead of a frame from the clip
```

`npm run covers` (needs ffmpeg + ffprobe on PATH, or `npm i -D ffmpeg-static ffprobe-static`) takes the newest `.mp4` in each `DONE` folder and writes, with a content hash in the name so they can be cached forever:

- `public/covers/<slug>.<hash>.mp4` — 1080², H.264, audio kept
- `public/covers/<slug>.<hash>.webm` — VP9, only kept when it beats the MP4 by 15 %+
- `public/covers/<slug>-sm.<hash>.mp4` — 540², silent, for cards
- `public/covers/<slug>.<hash>.jpg` — poster frame (the palette, OG card and no-JS fallback all come from this)
- `public/brand/hero.<hash>.*` — same set for the home hero
- `src/content/covers.generated.json` — the manifest the site reads

Commit the generated files; they are the deployable assets. A release picks up its artwork automatically when its `slug` in `src/content/releases.ts` matches the slugified folder name. `cover` / `coverVideo` on a release override the generated assets.

## How the cover → palette theming works

`src/lib/palette.ts`, called from server components at build:

1. Load the poster frame from `/public` (or an `https://` URL).
2. sharp downsamples it to ≤ 64 px and hands back raw RGB.
3. Median-cut quantization → 8 colour boxes with pixel share (deterministic, so builds are stable).
4. Score boxes: the most populous is *dominant*; the best chroma × population is *vibrant*; two more accents are picked for hue distance (or synthesized by hue rotation).
5. In OKLCH, derive `bg`, `fg`, `muted`, `accent`, `accent2`, `accent3`. Bright artwork gets a light theme, dark artwork a dark one. Every text/accent colour is nudged until it clears WCAG contrast against `bg` (7:1 body, 4.5:1 muted, 3:1 accents).
6. A 16 px WebP blur placeholder is generated in the same pass for `next/image`.

The result is written as CSS custom properties on a wrapper (`<ReleaseTheme>`), so every Tailwind token (`bg-bg`, `text-accent`, …) re-resolves inside it. The release page's blobs, marquee, buttons, `<meta name="theme-color">` and Open Graph card all use the same palette.

**If anything fails** (missing file, corrupt image, network) the brand palette is used and a warning is logged at build. The page still renders.

## Error handling

- **Cover images** — `CoverImage` swaps to a palette-coloured tile with the title on load error or missing `src`; layouts never collapse.
- **Palette extraction** — never throws; falls back to the brand palette (see above).
- **Streaming links** — only well-formed `https` links render; a release with none shows "Not on streaming services yet."
- **SoundCloud** — oEmbed lookups time out after 6 s and fall back to a link card; the player iframe is behind a click-to-load facade with a 12 s timeout and an "open on SoundCloud" escape hatch; each embed sits inside a client `ErrorBoundary`.
- **Contact form** — server-side validation, honeypot, best-effort rate limit; if mail isn't configured (no `RESEND_API_KEY`) or delivery fails the visitor gets a prefilled `mailto:` link so nothing is lost.
- **Routes** — `not-found.tsx`, `error.tsx` (keeps nav/footer, offers retry) and `global-error.tsx` (self-contained, no dependencies).

## Project layout

```
src/
  app/                    routes (App Router)
    page.tsx              home
    releases/             index + [slug] page + per-release opengraph-image
    wip/  merch/  contact/
    api/contact/route.ts  form delivery (Resend REST API)
    opengraph-image.tsx   site-wide social card
    robots.ts sitemap.ts manifest.ts icon.svg apple-icon.png
    error.tsx global-error.tsx not-found.tsx
    globals.css           tokens, utilities, keyframes
  brand/wordmark.ts       vectorised wordmark path + viewBoxes
  components/             UI (server components unless marked "use client")
    cover-media.tsx       poster + animated cover (autoplay / in-view / hover, sound toggle)
    wordmark.tsx          inline SVG wordmark (fill or outline)
    label-badge.tsx       rotating OPERATION FAIRWAY stamp
  content/                ← ALL editable content: site.ts releases.ts wip.ts merch.ts
    covers.generated.json manifest written by `npm run covers`
  lib/
    color.ts              OKLab/OKLCH + WCAG maths (pure)
    palette.ts            poster → theme (server only, sharp)
    covers.ts             release → poster/video resolver
    releases.ts soundcloud.ts theme.ts utils.ts
public/
  brand/                  wordmark.svg, hero clip + poster, 512px icon
  covers/                 generated cover clips + posters
  merch/                  product shots (4:5)
scripts/
  import-covers.mjs       _ANIMATIONS → public/covers + brand + manifest (ffmpeg)
  generate-placeholders.mjs   placeholder merch shots (delete when you have real photos)
_ANIMATIONS/              source clips (git-ignored)
```

## Editing content

Everything marked `TODO(ojinyx)` in `src/content/` is placeholder.

- **Add a release**: put the finished clip in `_ANIMATIONS/<ALBUM>/DONE/`, run `npm run covers`, add an entry with the matching slug to `src/content/releases.ts`. The page, theme, OG image and sitemap entry are generated. Titles go in allcaps. Leave `releaseDate` off until it's announced; undated releases show "Coming soon" and sort to the top.
- **Live discography**: `KINGDOMS` (album, 2026-09-11), `THE HILLS` (EP, same day), `WAR ON DRUGS` (EP, 2024-04-12). Dates, tracklists, durations and store links came from the Apple Music catalogue, the Spotify discography and the YouTube Music channel. Only a description per release is still missing.
- `KINGDOMS` and `THE HILLS` share a release date, so `KINGDOMS` carries `featured: true` to lead the discography and the home page. Remove that flag and ordering falls back to date alone.
- Titles are plain letters even where the cover art stylises them (the KINGDOMS artwork draws a slashed O). Track titles are normalised to allcaps; the 2024 WAR ON DRUGS metadata predates the convention and reads title case on Apple.
- Folder names are slugified for URLs, and accented or Nordic letters are transliterated, so a folder like `KINGDØMS/` still resolves to `/releases/kingdoms`. Where a folder is named after the image rather than the record, map it in `ALBUM_SLUGS` in the import script — that is how `_ANIMATIONS/BUNNY/` becomes `/releases/the-hills`, after the EP's lead track.
- **WIP**: paste public SoundCloud track/playlist URLs into `src/content/wip.ts`.
- **Merch**: `src/content/merch.ts`; set `site.merchStoreUrl` or per-item `url` to your Bandcamp/Shopify/Big Cartel store.
- **Bio, socials, email, tagline**: `src/content/site.ts`.
- Optional per-track `previewUrl` (mp3 under `/public`) renders an inline preview player.

`_ANIMATIONS/` (source videos, project files) is gitignored so it never lands in the deploy repo. Anything the site should serve belongs under `public/`.

## Local development

```bash
npm install
npm run dev
```

Other scripts: `npm run build` (production build + type check), `npm run lint`, `npm run typecheck`, `npm run covers` (import artwork from `_ANIMATIONS`, see above), `npm run placeholders` (regenerate placeholder merch shots).

## Deploying to Vercel (existing repo + custom domain)

The repo lives at [crystalball-dev/ojinyx-website](https://github.com/crystalball-dev/ojinyx-website). Let Vercel build it — see the Windows note below.

1. Push this code to the repository (the project root is the repo root; `vercel.json` just pins the framework).
2. In Vercel: **Add New → Project → Import** the repo. Framework preset is detected as Next.js. Build command `next build`, output default. Node 20+ (see `engines` in `package.json`).
3. **Environment variables** (Project → Settings → Environment Variables), from `.env.example`:
   - `NEXT_PUBLIC_SITE_URL=https://ojinyx.com` (Production). Drives canonical URLs, sitemap and OG image URLs.
   - `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` — optional; the form degrades to `mailto:` without them.
4. **Domain**: Project → Settings → Domains → add `ojinyx.com` and `www.ojinyx.com`. Point DNS at Vercel as instructed (A `76.76.21.21` for apex, CNAME `cname.vercel-dns.com` for `www`, or use Vercel nameservers). Set one as primary and let Vercel redirect the other (it does this with one toggle; no code needed).
5. Deploy. Every push to the production branch builds; other branches get preview URLs.

> **Do not deploy a locally-built bundle from Windows.** `vercel deploy` builds locally on Windows and emits every serverless function as a symlink into a shared `releases/[slug].func`. Those symlinks don't survive the upload and the deploy fails with `ENOENT … _global-error.func`. Importing the repo (or any deploy that builds on Vercel's Linux runners) sidesteps it. If you ever do need the CLI, run it from WSL or a Linux/macOS machine.

What runs where:

- All pages are **statically generated** at build (release themes included). `/wip` is ISR with a 24 h revalidation so SoundCloud titles/art refresh without a redeploy.
- `/api/contact` is the only server function.
- Images go through Vercel's image CDN (AVIF/WebP, 31-day cache). `/covers/*`, `/brand/*` and `/merch/*` are served immutable; generated cover and hero files carry a content hash, so re-running `npm run covers` after changing a clip produces new URLs automatically.
- Video is served as static files from `public/` (range requests work out of the box). Cards use the 540² silent variant; heroes and release pages use the full clip, which starts loading only after the poster has painted. Phones get the small variant everywhere.
- Encoding quality lives in `PROFILES` in the import script. The hero is deliberately expensive: its source is full of fine vertical grain, and a high CRF turns that into mush, so it encodes at native 1080² and costs roughly 8 MB. Raising `crf` to 25 saves about 2 MB and still looks far better than the 900²/27 profile it replaced.

## Performance notes

- Home page JS is essentially the React/Next runtime; the site's own client islands (nav, reveals, tilt, pointer glow, cover fallback, contact form) add a few KB. Everything else is server-rendered HTML.
- The hero entrance and parallax are CSS (`@keyframes` + `animation-timeline: scroll()` where supported), so the largest text paints on the first frame and LCP doesn't wait for hydration.
- Blobs are pre-softened radial gradients moved with `transform` only — no `filter: blur()` on large surfaces. Grain is a single static SVG noise tile.
- `prefers-reduced-motion` stops the blobs, marquees, entrance and parallax; Motion's `reducedMotion="user"` covers the rest.

## Recommended next steps (not built, on purpose)

- **Persistent mini player** — a global `<audio>` element in the layout so previews keep playing across navigation (small; the current `PreviewPlayer` would become its remote control).
- **`_ANIMATIONS/OJINYX/OJINYX TOO.mp4`** (3006², 15 s, 68 MB) isn't in a `DONE` folder so it's untouched; if it's meant for the site (a full-screen loop, a WIP page backdrop), decide where and the import script can grow a profile for it.
- **Auto-discover releases from Spotify or Bandcamp** — a build-time fetch keyed on an artist ID would replace hand-editing `releases.ts`; keep the local override for covers you want to art-direct.
- **Mailing list** — one field posting to Buttondown/Resend Audiences; the contact route already has the delivery plumbing.
- **Shows page** — Bandsintown/Songkick have public widgets and JSON feeds; the same facade pattern as SoundCloud applies.
- **CMS** — if someone non-technical will edit content, a git-based CMS (Keystatic, Decap) over `src/content` avoids adding a database.
- **CSP header** — once the third-party surface is final (SoundCloud, Vercel analytics), add a Content-Security-Policy in `next.config.ts` `headers()`.
- **Vercel WAF rate limiting** on `/api/contact` if the honeypot isn't enough.
