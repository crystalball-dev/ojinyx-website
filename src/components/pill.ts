import { cn } from "@/lib/utils";

/** Shared button/link styles. Kept dependency-free so client components can import them cheaply. */
export const pill =
  "label inline-flex items-center gap-2 rounded-full px-5 py-3 transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:-rotate-1 focus-visible:-translate-y-1";
export const pillSolid = cn(pill, "bg-accent text-accent-fg");
export const pillOutline = cn(pill, "border-2 border-current");
