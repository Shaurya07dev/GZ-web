import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { OurMissionSection } from "@/features/mission/our-mission-section";

export const metadata: Metadata = {
  title: "Our Mission | GalleryZone",
  description:
    "GalleryZone's vision and mission: India's most trusted art ecosystem, connecting artists, collectors, businesses and communities.",
};

export default function OurMissionPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <OurMissionSection />
      </main>
      <SiteFooter />
    </>
  );
}
