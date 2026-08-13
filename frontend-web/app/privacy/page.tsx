import type { Metadata } from "next";
import { LegalLayout } from "@/features/legal/legal-layout";
import { LegalToc } from "@/features/legal/legal-toc";
import { LegalSectionBlock } from "@/features/legal/legal-section";
import { privacySections } from "@/features/legal/data/privacy-sections";

export const metadata: Metadata = {
  title: "Privacy Policy — GalleryZone",
  description:
    "What GalleryZone collects, how it's used, and who it's shared with.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="August 2026">
      <LegalToc sections={privacySections} />
      <article className="flex max-w-3xl flex-1 flex-col gap-10">
        {privacySections.map((section) => (
          <LegalSectionBlock key={section.id} section={section} />
        ))}
      </article>
    </LegalLayout>
  );
}
