import type { Metadata } from "next";
import { MerchCard } from "@/components/merch-card";
import { SectionHeading } from "@/components/section-heading";
import { pillSolid } from "@/components/pill";
import { merch } from "@/content/merch";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Merch",
  description: `${site.name} merchandise — tees, hoodies, posters.`,
  alternates: { canonical: "/merch" },
};

export default function MerchPage() {
  const storeUrl = site.merchStoreUrl || undefined;
  return (
    <div className="gutter pb-24 pt-32 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading as="h1" label="Wear the colours" title="Merch" />
        {storeUrl ? (
          <a href={storeUrl} target="_blank" rel="noreferrer" className={pillSolid}>
            Open the store <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <p className="label max-w-xs text-muted">Store opening soon — items below are a preview.</p>
        )}
      </div>

      {merch.length === 0 ? (
        <p className="mt-16 text-xl text-muted">Nothing for sale yet.</p>
      ) : (
        <ul className="mt-16 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {merch.map((item, i) => (
            <li key={item.id} className={i % 2 ? "sm:mt-10" : undefined}>
              <MerchCard item={item} storeUrl={storeUrl} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
