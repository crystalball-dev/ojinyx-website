"use client";

/**
 * Last-resort boundary: replaces the root layout, so it must render <html>
 * and <body> itself and can't rely on the app's fonts or Tailwind.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#06020c", color: "#f3eef7", fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: "3rem", lineHeight: 1, textTransform: "uppercase", letterSpacing: "-0.03em", margin: 0 }}>Signal lost</h1>
          <p style={{ opacity: 0.7, fontSize: "1.125rem" }}>The site hit an unexpected error.</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#ff2bd6", color: "#000", border: 0, borderRadius: 999, padding: "0.9rem 1.5rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: "0.75rem", cursor: "pointer" }}
          >
            Reload
          </button>
          {error.digest ? <p style={{ opacity: 0.5, fontSize: "0.75rem", marginTop: "1.5rem" }}>ref {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
