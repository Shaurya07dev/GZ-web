import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactSection } from "@/features/contact/contact-section";

export const metadata: Metadata = {
  title: "Contact — GalleryZone",
  description:
    "Questions about listing art, buying a piece, or partnering with GalleryZone as a gallery. Get in touch with our team.",
};

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
