import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutFlow } from "@/features/checkout/checkout-flow";
import { getArtworkById } from "@/lib/mock-data/helpers";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(
  props: PageProps<"/checkout">,
): Promise<Metadata> {
  const { artworkId } = await props.searchParams;
  const artwork = getArtworkById(firstParam(artworkId) ?? "");

  return {
    title: artwork
      ? `Checkout | ${artwork.title} | GalleryZone`
      : "Checkout | GalleryZone",
    description: "Review your delivery address and confirm your order.",
  };
}

// Reads ?artworkId=... the same way /register reads ?role=... — a required
// query param linked live from ArtworkInfoPanel's "Buy Now" button, not an
// optional nicety. A missing or unresolvable id renders a small dead-end
// state instead of a broken form (SAD-equivalent rule from the design spec
// §5), the same shape as the old "coming soon" stub this page replaces.
export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const { artworkId } = await props.searchParams;
  const artwork = getArtworkById(firstParam(artworkId) ?? "");

  if (!artwork) {
    return (
      <>
        <SiteHeader />
        <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-24">
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[140px]"
            aria-hidden
          />
          <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
            <div
              className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-card"
              aria-hidden
            >
              <ShoppingBag
                className="size-6 text-gold-bright"
                strokeWidth={1.5}
              />
            </div>
            <h1 className="mt-8 text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
              Nothing to check out.
            </h1>
            <p className="mt-5 max-w-sm text-balance text-base leading-relaxed text-muted-foreground">
              We couldn&rsquo;t find an artwork to buy. Head back to the
              marketplace and pick a piece to get started.
            </p>
            <Link
              href="/marketplace"
              className="group mt-9 inline-flex items-center gap-2 rounded-md border border-gold/60 px-6 py-3 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
            >
              Browse the marketplace
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-10 lg:px-10 lg:py-14">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-xs text-muted-foreground"
          >
            <Link
              href="/marketplace"
              className="transition-colors hover:text-gold-bright"
            >
              Marketplace
            </Link>
            <span className="mx-1.5" aria-hidden="true">
              /
            </span>
            <Link
              href={`/marketplace/${artwork.id}`}
              className="transition-colors hover:text-gold-bright"
            >
              {artwork.title}
            </Link>
            <span className="mx-1.5" aria-hidden="true">
              /
            </span>
            <span className="text-foreground/80">Checkout</span>
          </nav>

          <h1 className="mb-8 text-balance font-display text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Checkout
          </h1>

          <CheckoutFlow artwork={artwork} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
