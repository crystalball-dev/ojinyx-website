import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { SectionHeading } from "@/components/section-heading";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with ${site.name} — bookings, remixes, sync, press.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="gutter pb-24 pt-32 md:pt-40">
      <SectionHeading as="h1" label="Say hello" title="CONTACT" />

      <div className="mt-14 grid gap-14 md:grid-cols-12">
        <div className="flex flex-col gap-8 md:col-span-5">
          <p className="max-w-prose text-xl text-muted">Bookings, remixes, sync, press, or just to say the colors are too loud.</p>
          <div>
            <p className="label text-muted">Email</p>
            <a
              href={`mailto:${site.email}`}
              className="display mt-2 inline-block break-all text-[clamp(1.25rem,2.6vw,2rem)] underline-offset-8 hover:underline"
            >
              {site.email}
            </a>
          </div>
          {site.socials.length ? (
            <div>
              <p className="label text-muted">Elsewhere</p>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                {site.socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noreferrer" className="display text-xl uppercase underline-offset-8 hover:underline">
                      {s.label} <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <ContactForm email={site.email} />
        </div>
      </div>
    </div>
  );
}
