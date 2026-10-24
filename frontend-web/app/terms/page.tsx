import type { Metadata } from "next";
import { LegalLayout } from "@/features/legal/legal-layout";
import { LegalToc } from "@/features/legal/legal-toc";
import { LegalSectionBlock } from "@/features/legal/legal-section";
import { termsSections } from "@/features/legal/data/terms-sections";

export const metadata: Metadata = {
  title: "Terms & Conditions | GalleryZone",
  description:
    "The general terms and conditions that govern use of the GalleryZone website.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms & Conditions" lastUpdated="October 2026">
      <LegalToc sections={termsSections} />
      <article className="flex max-w-3xl flex-1 flex-col gap-10">
        {termsSections.map((section) => (
          <LegalSectionBlock key={section.id} section={section} />
        ))}
      </article>
    </LegalLayout>
  );
}
