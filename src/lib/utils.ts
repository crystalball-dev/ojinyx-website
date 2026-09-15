/** Tiny className joiner — avoids a dependency for the handful of places we need it. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Escape "<" so JSON-LD can't break out of its <script> tag. The replacement
 * is the six characters backslash-u-0-0-3-c, which JSON parsers decode back
 * to "<" while HTML never sees a literal "</script>".
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
