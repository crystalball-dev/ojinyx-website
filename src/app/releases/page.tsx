import type { Metadata } from "next";
import { ReleaseCard } from "@/components/release-card";
import { SectionHeading } from "@/components/section-heading";
import { sortedReleases } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Releases",
  description: "Every ojinyx release. Each page is unique, just like the records.",
  alternates: { canonical: "/releases" },
};

export default function ReleasesPage() {
  return (
    <div className="gutter pb-24 pt-32 md:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading as="h1" label={`${sortedReleases.length} ${sortedReleases.length === 1 ? "record" : "records"}`} title="RELEASES" />
        {/* Set as a sentence, not a label: two lines of uppercase micro-type
            would shout and wrap badly next to the heading. */}
        <p className="mb-2 max-w-sm text-lg leading-snug text-muted">
          Each page is unique, just like the records. Bold colors catered for your viewing pleasure.
        </p>
      </div>

      {sortedReleases.length ? (
        <ul className="mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">
          {sortedReleases.map((release, i) => (
            <li key={release.slug} className={i % 3 === 1 ? "sm:mt-12" : undefined}>
              <ReleaseCard release={release} index={i} priority={i < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-16 text-xl text-muted">Nothing out yet. Soon.</p>
      )}
    </div>
  );
}
