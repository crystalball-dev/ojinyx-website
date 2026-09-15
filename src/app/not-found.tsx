import Link from "next/link";
import type { CSSProperties } from "react";
import { Blobs } from "@/components/blobs";
import { pillSolid } from "@/components/pill";

export default function NotFound() {
  return (
    <section className="hero relative flex min-h-[100svh] flex-col justify-end overflow-hidden">
      <Blobs />
      <div className="gutter relative flex flex-col gap-8 pb-16 pt-32">
        <h1 className="hero-name display -rotate-3" style={{ "--letters": 3 } as CSSProperties}>
          404
        </h1>
        <p className="max-w-md text-xl text-muted">That page skipped. Nothing here but colour.</p>
        <div>
          <Link href="/" className={pillSolid}>
            Back home
          </Link>
        </div>
      </div>
    </section>
  );
}
