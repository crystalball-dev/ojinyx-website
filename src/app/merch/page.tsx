import type { Metadata } from "next";
import { MerchCard } from "@/components/merch-card";
import { pillSolid } from "@/components/pill";
import { SectionHeading } from "@/components/section-heading";
import { merch } from "@/content/merch";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Merch",
  description: `Official ${site.name} merch. KINGDOMS on CD.`,
  alternates: { canonical: "/merch" },
};

export default function MerchPage() {
  const storeUrl = site.merchStoreUrl || undefined;
  // A lone product in a four-column grid reads as missing stock, so the
  // grid only widens once there is something to fill it.
  const columns = merch.length >= 4 ? "lg:grid-cols-4" : merch.length === 3 ? "lg:grid-cols-3" : "max-w-3xl";

  return (
    <div className="gutter pb-24 pt-32 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading as="h1" label="Official merch" title="MERCH" />
        {storeUrl ? (
          <a href={storeUrl} target="_blank" rel="noreferrer" className={pillSolid}>
            {site.merchStoreLabel} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>

      {merch.length === 0 ? (
        <p className="mt-16 text-xl text-muted">Nothing for sale right now. Check back soon.</p>
      ) : (
        <ul className={`mt-16 grid gap-x-6 gap-y-12 sm:grid-cols-2 ${columns}`}>
          {merch.map((item, i) => (
            <li key={item.id} className={i % 2 ? "sm:mt-10" : undefined}>
              <MerchCard item={item} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
