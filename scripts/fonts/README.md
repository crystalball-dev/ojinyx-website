# Fonts

Static instances of **Unbounded**, the site's display face (`--font-display-family`).
The site itself gets this font from `next/font/google` at build time; these copies
exist so the asset scripts under `scripts/` can typeset with it without depending
on what is installed on the machine running them.

| File | Weight | Source |
| --- | --- | --- |
| `Unbounded-Bold.ttf` | 700 | Google Fonts (`fonts.gstatic.com`), family `Unbounded` |
| `Unbounded-Black.ttf` | 900 | Google Fonts (`fonts.gstatic.com`), family `Unbounded` |

Licensed under the **SIL Open Font License 1.1**, which permits redistribution
and bundling. See <https://fonts.google.com/specimen/Unbounded/license>.

`make-kingdoms-cards.mjs` writes a fontconfig file into the OS temp directory
pointing at this folder and sets `FONTCONFIG_FILE` before importing sharp —
librsvg resolves font families through fontconfig, and it reads its config once
at initialization, so that has to happen before the first import.
