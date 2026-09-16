import type { MerchItem } from "./types";

/**
 * Merchandise.
 * ─────────────────────────────────────────────────────────────────────────
 * TODO(ojinyx): replace placeholder items + images in /public/merch. Each
 * item links to `url` (or site.merchStoreUrl when unset). Items with
 * available: false render as "sold out / coming soon" and aren't clickable.
 * Names follow the house style: record titles in allcaps.
 */
export const merch: MerchItem[] = [
  {
    id: "tee-bunny",
    name: "BUNNY TEE",
    price: "$35",
    image: "/merch/tee-acid.jpg",
    url: "",
    available: true,
    variants: ["S", "M", "L", "XL"],
  },
  {
    id: "hoodie-kingdoms",
    name: "KINGDØMS HOODIE",
    price: "$70",
    image: "/merch/hoodie-black.jpg",
    url: "",
    available: true,
    variants: ["S", "M", "L", "XL", "XXL"],
  },
  {
    id: "cap-war-on-drugs",
    name: "WAR ON DRUGS CAP",
    price: "$28",
    image: "/merch/cap-pink.jpg",
    url: "",
    available: false,
  },
  {
    id: "poster-set",
    name: "COVER ART POSTER SET (3)",
    price: "$45",
    image: "/merch/poster-set.jpg",
    url: "",
    available: true,
  },
];
