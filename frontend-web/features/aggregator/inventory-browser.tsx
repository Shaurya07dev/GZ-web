"use client";

import { useMemo, useState } from "react";
import { Heart, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { STAMP_TONE } from "@/components/shared/rarity-badge";
import { FilterGroup, OptionRow } from "@/features/marketplace/marketplace-filters";
import { useReservableInventory } from "@/hooks/useAggregatorInventory";
import { useWishlistStore } from "@/store/useWishlistStore";
import {
  INVENTORY_PRICE_BANDS,
  NO_FILTERS,
  activeFilterCount,
  applyInventory,
  inventoryFacets,
  type InventoryFilters,
} from "@/lib/inventory-filters";
import { cn, formatINR, humanize } from "@/lib/utils";
import { ARTWORK_RARITY_OPTIONS, type ArtworkSizeBand } from "@/types/artwork";
import { ReservableInventoryGrid } from "./reservable-inventory-grid";

const SIZE_OPTIONS: { value: ArtworkSizeBand; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

function bandLabel(i: number): string {
  const { min, max } = INVENTORY_PRICE_BANDS[i] ?? {};
  if (min === undefined && max !== undefined) return `Under ${formatINR(max)}`;
  if (max === undefined && min !== undefined) return `Above ${formatINR(min)}`;
  return `${formatINR(min ?? 0)} – ${formatINR(max ?? 0)}`;
}

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// The search bar, the Filters panel and the category chips above Browse GalleryZone's grid. The grid
// filters its own list with what is set here (see lib/inventory-filters.ts).
export function InventoryBrowser() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<InventoryFilters>(NO_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const { data } = useReservableInventory();
  const savedIds = useWishlistStore((s) => s.ids);
  const saved = useMemo(() => new Set(savedIds), [savedIds]);
  const savedOnShelf = useMemo(() => (data ?? []).filter((a) => saved.has(a.id)).length, [data, saved]);

  const facets = useMemo(() => inventoryFacets(data ?? []), [data]);
  const matching = useMemo(() => applyInventory(data ?? [], query, filters, "newest", saved).length, [data, query, filters, saved]);
  const badge = activeFilterCount(filters);

  const update = (patch: Partial<InventoryFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const clearAll = () => {
    setQuery("");
    setFilters(NO_FILTERS);
  };
  const clearPanel = () => setFilters((f) => ({ ...NO_FILTERS, category: f.category, savedOnly: f.savedOnly }));

  const chips: { value: string | null; label: string }[] = [
    { value: null, label: "All" },
    ...facets.categories.map((c) => ({ value: c, label: humanize(c) })),
  ];
  const rankOptions = ARTWORK_RARITY_OPTIONS.filter((o) => facets.ranks[o.value]);
  const sizeOptions = SIZE_OPTIONS.filter((o) => facets.sizes[o.value]);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <label htmlFor="inventory-search" className="sr-only">
              Search artworks, artists or styles
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="inventory-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artworks, artists, or styles..."
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-muted/30 py-2.5 pr-10 pl-9 text-base outline-none transition-all placeholder:text-muted-foreground focus:border-gold/50 focus:ring-1 focus:ring-gold/50 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SlidersHorizontal className="size-4" />
            <span>Filters</span>
            {badge > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-gold-bright text-[11px] font-bold text-[#171310] tabular-nums">
                {badge}
              </span>
            )}
          </button>
        </div>

        {/* Category chips: only what is on the shelf. Horizontally scrollable, with a fade so the row reads as
            scrollable instead of cut off mid-word on mobile. */}
        <div className="relative -mx-4 sm:mx-0">
          <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-2 sm:px-0 sm:pb-0">
            {chips.map((chip) => {
              const active = filters.category === chip.value;
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ category: chip.value })}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "border-gold bg-gold/90 text-gold-950"
                      : "border-border bg-muted/20 text-foreground hover:bg-muted/50",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={filters.savedOnly}
              onClick={() => update({ savedOnly: !filters.savedOnly })}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filters.savedOnly
                  ? "border-gold bg-gold/90 text-gold-950"
                  : "border-border bg-muted/20 text-foreground hover:bg-muted/50",
              )}
            >
              <Heart className={cn("size-3.5", filters.savedOnly && "fill-current")} strokeWidth={1.75} />
              Saved
              <span className="tabular-nums opacity-70">{savedOnShelf}</span>
            </button>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden"
          />
        </div>
      </div>

      <ReservableInventoryGrid query={query} filters={filters} onClear={clearAll} />

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="font-display text-lg">Filters</SheetTitle>
            <SheetDescription>Narrow what is available to reserve.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4">
            <Accordion multiple defaultValue={["price", "medium"]}>
              {facets.prices.some((n) => n > 0) && (
                <FilterGroup value="price" label="Price">
                  {INVENTORY_PRICE_BANDS.map((_, i) => {
                    const checked = filters.price === i;
                    if (!facets.prices[i] && !checked) return null;
                    return (
                      <OptionRow
                        key={i}
                        label={bandLabel(i)}
                        count={facets.prices[i] ?? 0}
                        checked={checked}
                        onToggle={() => update({ price: checked ? null : i })}
                      />
                    );
                  })}
                </FilterGroup>
              )}

              {facets.mediums.length > 0 && (
                <FilterGroup value="medium" label="Medium">
                  {facets.mediums.map(([medium, count]) => (
                    <OptionRow
                      key={medium}
                      label={humanize(medium)}
                      count={count}
                      checked={filters.mediums.includes(medium)}
                      onToggle={() => update({ mediums: toggleIn(filters.mediums, medium) })}
                    />
                  ))}
                </FilterGroup>
              )}

              {sizeOptions.length > 0 && (
                <FilterGroup value="size" label="Size">
                  {sizeOptions.map((option) => {
                    const checked = filters.size === option.value;
                    return (
                      <OptionRow
                        key={option.value}
                        label={option.label}
                        count={facets.sizes[option.value] ?? 0}
                        checked={checked}
                        onToggle={() => update({ size: checked ? null : option.value })}
                      />
                    );
                  })}
                </FilterGroup>
              )}

              {rankOptions.length > 0 && (
                <FilterGroup value="rank" label="Rank">
                  {rankOptions.map((option) => (
                    <OptionRow
                      key={option.value}
                      label={option.label}
                      count={facets.ranks[option.value] ?? 0}
                      checked={filters.ranks.includes(option.value)}
                      onToggle={() => update({ ranks: toggleIn(filters.ranks, option.value) })}
                      leading={
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            STAMP_TONE[option.value],
                          )}
                        >
                          {option.value}
                        </span>
                      }
                    />
                  ))}
                </FilterGroup>
              )}

              {(facets.verified > 0 || facets.exclusive > 0) && (
                <FilterGroup value="more" label="Artist and edition">
                  {facets.verified > 0 && (
                    <OptionRow
                      label="Verified artists only"
                      count={facets.verified}
                      checked={filters.verifiedOnly}
                      onToggle={() => update({ verifiedOnly: !filters.verifiedOnly })}
                    />
                  )}
                  {facets.exclusive > 0 && (
                    <OptionRow
                      label="Exclusive to GalleryZone"
                      count={facets.exclusive}
                      checked={filters.exclusiveOnly}
                      onToggle={() => update({ exclusiveOnly: !filters.exclusiveOnly })}
                    />
                  )}
                </FilterGroup>
              )}
            </Accordion>
          </div>

          <div className="flex items-center gap-3 border-t border-border bg-background p-4">
            <button
              type="button"
              onClick={clearPanel}
              disabled={badge === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <RotateCcw className="size-4" strokeWidth={1.75} />
              Reset
            </button>
            <SheetClose
              render={
                <button
                  type="button"
                  className="flex-[2] rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-transform active:scale-[0.97] dark:bg-gold-bright dark:text-[#171310]"
                />
              }
            >
              {matching === 1 ? "Show 1 artwork" : `Show ${matching} artworks`}
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
