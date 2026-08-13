"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  MarketplaceFilters,
  DEFAULT_MARKETPLACE_FILTERS,
} from "@/features/marketplace/marketplace-filters";
import { MarketplaceSearchBar } from "@/features/marketplace/marketplace-search-bar";
import { MarketplaceGrid } from "@/features/marketplace/marketplace-grid";
import type { ArtworkFilters } from "@/types/artwork";

// Client component (not server-rendered per SAD §5.6's "listing = streaming
// Server Component" guidance) because the filter bar, search, and sort are
// genuinely interactive client state. Filters stay client-only (Task 14) -
// the one exception is reading `category`/`q` from the URL on first load, so
// the nav's "Explore" mega menu and search box can actually land on a
// pre-filtered grid instead of a generic listing page.
export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ArtworkFilters>(() => ({
    ...DEFAULT_MARKETPLACE_FILTERS,
    category: searchParams.get("category") ?? undefined,
    query: searchParams.get("q") ?? undefined,
  }));

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="border-b border-border/60 bg-card/30 px-6 py-14 lg:px-10 lg:py-16">
          <div className="mx-auto max-w-[1400px]">
            <h1 className="text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
              The Marketplace
            </h1>
            <p className="mt-3 max-w-xl text-balance text-base leading-relaxed text-muted-foreground">
              Original, verified artwork from independent artists across
              India. Every piece ships with a signed certificate of
              authenticity.
            </p>
            <MarketplaceSearchBar
              value={filters.query ?? ""}
              onChange={(query) =>
                setFilters((current) => ({
                  ...current,
                  query: query || undefined,
                }))
              }
              className="mt-8 max-w-md"
            />
          </div>
        </section>

        <section className="px-6 py-10 lg:px-10">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            <MarketplaceFilters filters={filters} onChange={setFilters} />
            <MarketplaceGrid
              filters={filters}
              onClearFilters={() => setFilters(DEFAULT_MARKETPLACE_FILTERS)}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
