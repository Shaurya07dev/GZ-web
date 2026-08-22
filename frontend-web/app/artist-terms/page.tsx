import type { Metadata } from "next";
import { LegalLayout } from "@/features/legal/legal-layout";
import { LegalToc } from "@/features/legal/legal-toc";
import { LegalSectionBlock } from "@/features/legal/legal-section";
import { artistTermsSections } from "@/features/legal/data/artist-terms-sections";

export const metadata: Metadata = {
  title: "Artist Terms & Conditions | GalleryZone",
  description:
    "Terms & Conditions governing artwork submission, listing, promotion, and sale by Artists on GalleryZone.",
};

export default function ArtistTermsPage() {
  return (
    <LegalLayout title="Artist Terms & Conditions" lastUpdated="August 2026">
      <LegalToc sections={artistTermsSections} />
      <article className="flex max-w-3xl flex-1 flex-col gap-10">
        {artistTermsSections.map((section) => (
          <LegalSectionBlock key={section.id} section={section} />
        ))}
      </article>
    </LegalLayout>
  );
}
