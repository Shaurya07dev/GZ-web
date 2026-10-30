"use client";

import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { artworkService } from "@/services/artworkService";
import { toSummary } from "@/lib/artwork-summary";
import { ArtworkCard } from "@/components/shared/artwork-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ArtworkCardSkeleton } from "@/components/shared/artwork-card-skeleton";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useMounted } from "@/hooks/useMounted";
import { useCartStore } from "@/store/useCartStore";
import { formatINR } from "@/lib/utils";

export default function CartPage() {
  const mounted = useMounted();
  const entries = useCartStore((state) => state.entries);
  const remove = useCartStore((state) => state.remove);

  // Each item is read fresh so a sold or delisted piece drops out of the list
  // the same way the wishlist handles it.
  const results = useQueries({
    queries: entries.map((e) => ({
      queryKey: ["artwork", e.artworkId],
      queryFn: () => artworkService.get(e.artworkId),
      staleTime: 60_000,
    })),
  });
  const loading = mounted && results.some((r) => r.isPending);
  const items = results
    .map((r) => r.data)
    .filter((artwork) => artwork !== undefined && artwork !== null);

  const available = items.filter((a) => a.status === "marketplace");
  const unavailable = items.filter((a) => a.status !== "marketplace");
  const subtotal = available.reduce((sum, a) => sum + a.customerPrice, 0);

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col py-6 px-5 sm:py-8 sm:px-8 lg:py-10 lg:px-10 max-w-[1500px] mx-auto w-full gap-6 sm:gap-8">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Your Cart
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Checkout one piece at a time — each artwork is an original and ships
            direct from the artist.
          </p>
        </div>

        {!mounted || loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ArtworkCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Browse the marketplace and tap Add to Cart on anything you're thinking about."
            action={
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-md border border-gold/60 px-4 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
              >
                Browse the marketplace
              </Link>
            }
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-6">
              <section className="flex flex-col gap-4">
                {available.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {available.map((artwork) => (
                      <div key={artwork.id} className="relative">
                        <ArtworkCard artwork={toSummary(artwork)} />
                        <button
                          type="button"
                          onClick={() => remove(artwork.id)}
                          aria-label={`Remove ${artwork.title} from cart`}
                          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/70 shadow-sm backdrop-blur transition-colors hover:border-destructive/60 hover:text-destructive"
                        >
                          <X className="size-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {unavailable.length > 0 ? (
                  <div className="rounded-md border border-border bg-muted/30 p-4">
                    <h2 className="text-sm font-medium text-foreground">
                      No longer available
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      These pieces have sold or been removed since you added
                      them. They don't count toward your subtotal.
                    </p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {unavailable.map((artwork) => (
                        <li
                          key={artwork.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                        >
                          <span className="truncate text-muted-foreground">
                            {artwork.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => remove(artwork.id)}
                            className="text-xs font-medium text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            </div>

            <aside className="h-fit rounded-lg border border-border bg-card p-5 lg:sticky lg:top-24">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Summary
              </h2>
              <dl className="mt-4 space-y-2 border-b border-border pb-4 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground">
                    Available ({available.length})
                  </dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {formatINR(subtotal)}
                  </dd>
                </div>
              </dl>
              <div className="flex items-baseline justify-between pt-4">
                <span className="font-medium text-foreground">Subtotal</span>
                <span className="font-display text-lg font-semibold tabular-nums text-foreground">
                  {formatINR(subtotal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Shipping + GST calculated at checkout.
              </p>

              {available.length > 0 ? (
                <div className="mt-5 flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    Pieces check out one at a time so each artist is paid
                    cleanly. Pick one to proceed:
                  </p>
                  {available.map((artwork) => (
                    <Link
                      key={artwork.id}
                      href={`/checkout?artworkId=${artwork.id}`}
                      className="inline-flex w-full items-center justify-between gap-3 rounded-md border border-gold/60 px-3 py-2 text-xs font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
                    >
                      <span className="truncate">{artwork.title}</span>
                      <span className="shrink-0 text-foreground/70">
                        Checkout
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
