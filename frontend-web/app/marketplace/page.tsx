"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DoodleBackdrop } from "@/components/shared/doodle-backdrop";
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
//
// useSearchParams() opts a page out of static prerendering unless it sits
// below a Suspense boundary (Next.js requirement) — split into an outer
// Suspense wrapper and this inner component so `next build` can prerender
// the shell instead of failing the whole page.
export default function MarketplacePage() {
  return (
    <Suspense fallback={<MarketplaceFallback />}>
      <MarketplacePageContent />
    </Suspense>
  );
}

function MarketplaceFallback() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col" />
      <SiteFooter />
    </>
  );
}

function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ArtworkFilters>(() => ({
    ...DEFAULT_MARKETPLACE_FILTERS,
    category: searchParams.get("category") ?? undefined,
    query: searchParams.get("q") ?? undefined,
  }));

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col px-6 py-8 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1500px] gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
          <MarketplaceFilters
            filters={filters}
            onChange={setFilters}
            className="lg:sticky lg:top-24"
          />

          <div className="flex flex-col gap-6">
            <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/30 px-6 py-10 sm:px-8 sm:py-12">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[url('/backgrounds/marketplace-lotus.png')] bg-cover bg-right bg-no-repeat dark:hidden"
              />
              <div className="hidden dark:block">
                <DoodleBackdrop />
              </div>
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/95 via-card/60 to-transparent"
                aria-hidden="true"
              />
              <div className="relative">
                <h1 className="text-balance font-display text-4xl leading-[1.1] font-bold tracking-tight text-foreground uppercase sm:text-5xl">
                  The Marketplace
                </h1>
                <p className="mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground">
                  Discover original, verified artworks from independent
                  artists across India. Every piece ships with a signed
                  certificate of authenticity.
                </p>
                <MarketplaceSearchBar
                  value={filters.query ?? ""}
                  onChange={(query) =>
                    setFilters((current) => ({
                      ...current,
                      query: query || undefined,
                    }))
                  }
                  className="mt-8 max-w-lg"
                />
              </div>
            </section>

            <MarketplaceGrid
              filters={filters}
              onChange={setFilters}
              onClearFilters={() => setFilters(DEFAULT_MARKETPLACE_FILTERS)}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
