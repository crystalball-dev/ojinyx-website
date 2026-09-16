import type { MerchItem } from "./types";

/**
 * Merchandise.
 * ─────────────────────────────────────────────────────────────────────────
 * Each item links out to where it is actually sold. Items with
 * `available: false` render as sold out and aren't clickable. Names follow
 * the house style: record titles in allcaps.
 *
 * Product photos from stores (Kunaki, Amazon) usually sit on a white
 * background; the merch card places them on a light panel and blends the
 * white away, so drop the store's image in as-is. Put images in
 * /public/merch with a content hash in the filename, since that folder is
 * served with immutable caching.
 *
 * All Kunaki listings: https://kunaki.com/msales.asp?PublisherId=249214&pp=1
 */
export const merch: MerchItem[] = [
  {
    id: "kingdoms-cd",
    name: "KINGDOMS",
    detail: "CD",
    price: "$8",
    image: "/merch/kingdoms-cd.3d3b41b9.jpg",
    url: "https://kunaki.com/sales.asp?PID=PX00ZDIO2E&pp=1",
    available: true,
  },
];
