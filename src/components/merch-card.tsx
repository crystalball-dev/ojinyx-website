import type { MerchItem } from "@/content/types";
import { cn } from "@/lib/utils";
import { CoverImage } from "./cover-image";

const TILTS = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1"];

export function MerchCard({ item, storeUrl, index }: { item: MerchItem; storeUrl?: string; index: number }) {
  const href = item.url || storeUrl || "";
  const available = item.available !== false;
  const clickable = available && /^https?:\/\//i.test(href);

  const body = (
    <article
      className={cn(
        "flex h-full flex-col gap-4 bg-fg/5 p-4 transition-transform duration-500 ease-[var(--ease-out-expo)]",
        TILTS[index % TILTS.length],
        clickable && "group-hover:-translate-y-1 group-hover:rotate-0",
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-black/20" style={{ containerType: "inline-size" }}>
        <CoverImage
          src={item.image}
          alt={item.name}
          fallbackLabel={item.name}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 92vw"
        />
        {!available ? (
          <span className="label absolute left-3 top-3 -rotate-6 bg-fg px-3 py-1 text-bg">Sold out</span>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="display text-xl">{item.name}</h3>
          {item.variants?.length ? <p className="label mt-1 text-muted">{item.variants.join(" / ")}</p> : null}
        </div>
        {item.price ? <span className="label whitespace-nowrap">{item.price}</span> : null}
      </div>
      <span className={cn("label mt-auto", clickable ? "text-accent" : "text-muted")}>
        {clickable ? "Buy ↗" : available ? "Coming soon" : "Sold out"}
      </span>
    </article>
  );

  return clickable ? (
    <a href={href} target="_blank" rel="noreferrer" className="group block h-full">
      {body}
    </a>
  ) : (
    <div className="h-full">{body}</div>
  );
}
