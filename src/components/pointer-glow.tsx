"use client";

import { useEffect, useRef } from "react";

/**
 * A single glow that lazily follows the pointer inside its positioned parent.
 * Mouse-only (pointer: fine) and off under reduced motion. Writes transforms
 * straight to the DOM from a rAF loop that stops as soon as it converges, so
 * an idle page costs nothing.
 */
export function PointerGlow({ color = "var(--accent-2)" }: { color?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let running = false;

    const tick = () => {
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      if (Math.abs(targetX - x) < 0.5 && Math.abs(targetY - y) < 0.5) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      el.style.opacity = "1";
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const onLeave = () => {
      el.style.opacity = "0";
    };

    parent.addEventListener("pointermove", onMove, { passive: true });
    parent.addEventListener("pointerleave", onLeave);
    return () => {
      parent.removeEventListener("pointermove", onMove);
      parent.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-0 h-[55vmax] w-[55vmax] rounded-full opacity-0 transition-opacity duration-700 will-change-transform"
      style={{
        background: `radial-gradient(closest-side, ${color} 0%, transparent 70%)`,
        mixBlendMode: "var(--blob-blend)" as never,
        transform: "translate3d(0,0,0) translate(-50%, -50%)",
      }}
    />
  );
}
