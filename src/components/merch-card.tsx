import type { MerchItem } from "@/content/types";
import { cn } from "@/lib/utils";
import { CoverImage } from "./cover-image";

const TILTS = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1"];

export function MerchCard({ item, index }: { item: MerchItem; index: number }) {
  const href = item.url ?? "";
  const available = item.available !== false;
  const clickable = available && /^https?:\/\//i.test(href);
  const meta = [item.detail, item.variants?.length ? item.variants.join(" / ") : undefined].filter(Boolean).join(" · ");

  const body = (
    <article
      className={cn(
        "flex h-full flex-col gap-4 bg-fg/5 p-4 transition-transform duration-500 ease-[var(--ease-out-expo)]",
        TILTS[index % TILTS.length],
        clickable && "group-hover:-translate-y-1 group-hover:rotate-0",
      )}
    >
      {/* Store product shots come on white. A light panel plus multiply blending
          dissolves that white into the panel, so the product sits on a clean
          backdrop instead of a pasted-on rectangle. `isolate` keeps the blend
          from reaching past the panel. */}
      <div className="relative isolate aspect-square overflow-hidden bg-[#eef1f4]" style={{ containerType: "inline-size" }}>
        <CoverImage
          src={item.image}
          alt={[item.name, item.detail].filter(Boolean).join(" ")}
          fallbackLabel={item.name}
          fit="contain"
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="p-[6%] mix-blend-multiply"
        />
        {!available ? (
          <span className="label absolute left-3 top-3 -rotate-6 bg-bg px-3 py-1 text-fg">Sold out</span>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="display text-2xl">{item.name}</h3>
          {meta ? <p className="label mt-1 text-muted">{meta}</p> : null}
        </div>
        {item.price ? <span className="display whitespace-nowrap text-2xl">{item.price}</span> : null}
      </div>
      <span className={cn("label mt-auto", clickable ? "text-accent" : "text-muted")}>
        {clickable ? "Buy now ↗" : available ? "Coming soon" : "Sold out"}
      </span>
    </article>
  );

  return clickable ? (
    <a href={href} target="_blank" rel="noreferrer" className="group block h-full" aria-label={`Buy ${item.name} ${item.detail ?? ""} for ${item.price ?? ""}`.replace(/\s+/g, " ").trim()}>
      {body}
    </a>
  ) : (
    <div className="h-full">{body}</div>
  );
}
