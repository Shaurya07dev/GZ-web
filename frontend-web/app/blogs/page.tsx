import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BlogsPublicList } from "@/features/blogs/blogs-public-list";

export const metadata: Metadata = {
  title: "Blogs | GalleryZone",
  description:
    "Essays, reflections and craft notes from the GalleryZone artist community.",
};

export default function BlogsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="mx-auto w-full max-w-3xl px-6 lg:px-10">
            <header className="mb-10 text-center">
              <h1 className="text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
                Writing by the artists on{" "}
                <span className="text-gold-bright italic">GalleryZone</span>.
              </h1>
              <p className="mt-6 text-balance text-base leading-relaxed text-muted-foreground">
                Essays, process notes, studio visits, and reflections on
                practice — submitted by GalleryZone artists and curated by our
                editors.
              </p>
            </header>
            <BlogsPublicList />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
