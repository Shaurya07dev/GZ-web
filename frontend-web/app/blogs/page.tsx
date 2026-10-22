import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PenTool } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Blogs | GalleryZone",
  description:
    "Essays, reflections and craft notes from the GalleryZone artist community. Opening soon.",
};

export default function BlogsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-medium tracking-[0.14em] text-gold-bright uppercase">
              <PenTool className="size-3.5" strokeWidth={1.75} />
              Blogs — coming soon
            </span>
            <h1 className="mt-8 text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
              Writing by the artists on <span className="text-gold-bright italic">GalleryZone</span>.
            </h1>
            <p className="mt-6 text-balance text-base leading-relaxed text-muted-foreground">
              Essays, process notes, studio visits, and reflections on practice —
              submitted by GalleryZone artists and curated by our editors.
              We&rsquo;re opening the first set of pieces shortly. If
              you&rsquo;re an artist listed on the platform and have a draft to
              share, please get in touch.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-md border border-gold/60 bg-gold/10 px-6 py-3 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/20"
              >
                Pitch an essay
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/artists"
                className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Meet the artists
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
