import type { Metadata } from "next";
import { LegalLayout } from "@/features/legal/legal-layout";
import { LegalToc } from "@/features/legal/legal-toc";
import { LegalSectionBlock } from "@/features/legal/legal-section";
import { aggregatorTermsSections } from "@/features/legal/data/aggregator-terms-sections";

export const metadata: Metadata = {
  title: "Aggregator Terms & Conditions | GalleryZone",
  description:
    "Terms & Conditions for Authorized Art Partners / Aggregators on GalleryZone.",
};

export default function AggregatorTermsPage() {
  return (
    <LegalLayout
      title="Aggregator Terms & Conditions"
      lastUpdated="August 2026"
    >
      <LegalToc sections={aggregatorTermsSections} />
      <article className="flex max-w-3xl flex-1 flex-col gap-10">
        {aggregatorTermsSections.map((section) => (
          <LegalSectionBlock key={section.id} section={section} />
        ))}
      </article>
    </LegalLayout>
  );
}
