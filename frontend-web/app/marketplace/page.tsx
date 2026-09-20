"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  MarketplaceFilters,
  DEFAULT_MARKETPLACE_FILTERS,
} from "@/features/marketplace/marketplace-filters";
import { MarketplaceSearchBar } from "@/features/marketplace/marketplace-search-bar";
import { MarketplaceGrid } from "@/features/marketplace/marketplace-grid";
import { cn } from "@/lib/utils";
import type { ArtworkFilters, ArtworkSummary } from "@/types/artwork";
import { useMarketplaceOverview } from "@/hooks/useArtworks";

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

// Quick-filter chips: one per category that is actually live, with the
// newest piece in that category as its thumbnail.
function quickCategories(categories: string[], artworks: ArtworkSummary[]) {
  return categories.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
    thumbnail: artworks.find((a) => a.category === value)?.thumbnailUrl,
  }));
}

function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ArtworkFilters>(() => ({
    ...DEFAULT_MARKETPLACE_FILTERS,
    category: searchParams.get("category") ? [searchParams.get("category")!] : undefined,
    query: searchParams.get("q") ?? undefined,
  }));
  const [showFilters, setShowFilters] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const overview = useMarketplaceOverview().data;
  const QUICK_CATEGORIES = quickCategories(overview?.facets.categories ?? [], overview?.artworks ?? []);

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        {/* ── MOBILE HERO ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#1a1410] px-5 py-8 lg:hidden">
          {/* Subtle dot-grid texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Warm glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-gold/20 blur-[80px]"
          />

          <div className="relative">
            <h1 className="font-display text-4xl font-bold leading-none tracking-tight text-white uppercase">
              The<br />Marketplace
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Discover original, verified artworks from independent artists
              across India. Every piece ships with a signed certificate of
              authenticity.
            </p>

            {/* Search */}
            <div className="mt-5">
              <MarketplaceSearchBar
                value={filters.query ?? ""}
                onChange={(query) =>
                  setFilters((f) => ({ ...f, query: query || undefined }))
                }
                dark
              />
            </div>

            {/* Quick category chips */}
            <div className="mt-6">
              <p className="text-xs font-semibold tracking-[0.12em] text-white/40 uppercase">
                Quick Filters
              </p>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() =>
                      setFilters((f) => {
                        const selected = f.category ?? [];
                        const next = selected.includes(cat.value)
                          ? selected.filter((c) => c !== cat.value)
                          : [...selected, cat.value];
                        return { ...f, category: next.length ? next : undefined };
                      })
                    }
                    className={cn(
                      "flex shrink-0 flex-col items-center gap-2 rounded-xl border p-1.5 transition-all",
                      filters.category?.includes(cat.value)
                        ? "border-gold bg-gold/20"
                        : "border-white/10 bg-white/5",
                    )}
                  >
                    <div className="relative size-14 overflow-hidden rounded-lg">
                      {cat.thumbnail && (
                        <Image
                          src={cat.thumbnail}
                          alt={cat.label}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-medium",
                        filters.category?.includes(cat.value)
                          ? "text-gold-bright"
                          : "text-white/70",
                      )}
                    >
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── DESKTOP HERO ────────────────────────────────────────────── */}
        <section className="relative hidden overflow-hidden rounded-none border-b border-border/40 bg-card/30 px-10 py-12 lg:block">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[url('/backgrounds/marketplace-lotus.png')] bg-cover bg-right bg-no-repeat dark:hidden"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/90 via-card/40 to-transparent"
            aria-hidden="true"
          />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            <h1 className="text-balance font-display text-4xl font-bold uppercase leading-[1.1] tracking-tight text-foreground">
              The Marketplace
            </h1>
            <p className="mt-4 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground">
              Discover original, verified artworks from independent artists
              across India. Every piece ships with a signed certificate of
              authenticity.
            </p>
            <MarketplaceSearchBar
              value={filters.query ?? ""}
              onChange={(query) =>
                setFilters((f) => ({ ...f, query: query || undefined }))
              }
              className="mt-8 w-full max-w-2xl"
            />
          </div>
        </section>

        {/* ── CONTENT AREA ─────────────────────────────────────────── */}
        <div className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-6 lg:px-10">
          <div
            className={cn(
              "grid w-full gap-8 lg:items-start transition-all",
              showFilters
                ? "lg:grid-cols-[280px_1fr]"
                : "lg:grid-cols-1",
            )}
          >
            {/* Desktop sidebar filters */}
            {showFilters && (
              <MarketplaceFilters
                filters={filters}
                onChange={setFilters}
                className="hidden lg:flex lg:sticky lg:top-24"
              />
            )}

            {/* Results */}
            <div className="flex min-w-0 flex-col gap-4">
              <MarketplaceGrid
                filters={filters}
                onChange={setFilters}
                onClearFilters={() => setFilters(DEFAULT_MARKETPLACE_FILTERS)}
                showFilters={showFilters}
                onToggleFilters={() => setShowFilters((s) => !s)}
                onOpenMobileFilters={() => setMobileFiltersOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* Mobile filter bottom sheet */}
        <MarketplaceMobileFilterSheet
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          filters={filters}
          onChange={setFilters}
        />
      </main>
      <SiteFooter />
    </>
  );
}

// ── Mobile filter bottom sheet ──────────────────────────────────────────────
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RotateCcw, X } from "lucide-react";

function MarketplaceMobileFilterSheet({
  open,
  onClose,
  filters,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  filters: ArtworkFilters;
  onChange: (f: ArtworkFilters) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bottom-0 top-auto left-0 right-0 max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 data-open:slide-in-from-bottom data-closed:slide-out-to-bottom"
      >
        <DialogTitle className="sr-only">Filter artworks</DialogTitle>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        {/* Scrollable filter body */}
        <div className="overflow-y-auto px-5 py-4">
          <MarketplaceFilters
            filters={filters}
            onChange={onChange}
            className="border-0 bg-transparent p-0 shadow-none"
            bare
          />
        </div>
        {/* Pinned footer */}
        <div className="flex items-center gap-3 border-t border-border bg-background px-5 py-4">
          <button
            type="button"
            onClick={() =>
              onChange({ ...DEFAULT_MARKETPLACE_FILTERS, query: filters.query })
            }
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="size-4" strokeWidth={1.75} />
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-[2] rounded-xl bg-gold-bright py-3 text-sm font-semibold text-[#171310] transition-colors hover:bg-gold"
          >
            Apply Filters
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
