import type { Metadata } from "next";
import { LegalLayout } from "@/features/legal/legal-layout";
import { LegalToc } from "@/features/legal/legal-toc";
import { LegalSectionBlock } from "@/features/legal/legal-section";
import { termsSections } from "@/features/legal/data/terms-sections";

export const metadata: Metadata = {
  title: "Terms of Service | GalleryZone",
  description:
    "The terms governing artists, aggregators, and customers using GalleryZone.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="August 2026">
      <LegalToc sections={termsSections} />
      <article className="flex max-w-3xl flex-1 flex-col gap-10">
        {termsSections.map((section) => (
          <LegalSectionBlock key={section.id} section={section} />
        ))}
      </article>
    </LegalLayout>
  );
}
