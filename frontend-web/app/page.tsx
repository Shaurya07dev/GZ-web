import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroSection } from "@/features/landing/hero-section";
import { IdentitySection } from "@/features/landing/identity-section";
import { EcosystemSection } from "@/features/landing/ecosystem-section";
import { JourneySection } from "@/features/landing/journey-section";
import { EarlyProgramSection } from "@/features/landing/early-program-section";
import { ClosingCtaSection } from "@/features/landing/closing-cta-section";
import { FaqSection } from "@/features/landing/faq-section";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <HeroSection />
        <IdentitySection />
        <EcosystemSection />
        <JourneySection />
        <EarlyProgramSection />
        <ClosingCtaSection />
        <FaqSection />
      </main>
      <SiteFooter />
    </>
  );
}
