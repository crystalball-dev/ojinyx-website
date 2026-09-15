"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  max?: number;
}

/**
 * Pointer-driven 3D tilt. A rAF loop eases the rotation toward the pointer
 * and stops as soon as it settles, writing `transform` directly (no React
 * re-renders). Mouse only; inert under reduced motion.
 */
export function TiltCard({ children, className, max = 7 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let running = false;

    const tick = () => {
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      const settled = Math.abs(targetX - x) < 0.02 && Math.abs(targetY - y) < 0.02;
      if (settled && targetX === 0 && targetY === 0) {
        el.style.transform = "";
        running = false;
        return;
      }
      el.style.transform = `perspective(1100px) rotateX(${y.toFixed(2)}deg) rotateY(${x.toFixed(2)}deg)`;
      if (settled) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = px * 2 * max;
      targetY = -py * 2 * max;
      kick();
    };
    const reset = () => {
      targetX = 0;
      targetY = 0;
      kick();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", reset);
    el.addEventListener("pointercancel", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      el.removeEventListener("pointercancel", reset);
      cancelAnimationFrame(raf);
    };
  }, [max]);

  return (
    <div ref={ref} className={cn("will-change-transform", className)} style={{ transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}
