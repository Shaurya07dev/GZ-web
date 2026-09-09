"use client";

import { useId, useMemo } from "react";
import {
  RotateCcw,
  Filter,
  Shapes,
  Palette,
  Star,
  IndianRupee,
  Ruler,
  User,
  MapPin,
  CircleCheck,
} from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { mockArtworks } from "@/lib/mock-data/artworks";
import { mockArtists } from "@/lib/mock-data/artists";
import {
  ARTWORK_RARITY_OPTIONS,
  type ArtworkFilters,
  type ArtworkRarity,
  type ArtworkSizeBand,
} from "@/types/artwork";

// Sentinel for "no selection" in the Select primitives below, which need a
// real string value - mapped back to `undefined` on the ArtworkFilters
// object so filterArtworks() (Task 2) sees an absent field, not a literal
// "all" category.
const ALL_VALUE = "all";

const CATEGORY_OPTIONS = Array.from(
  new Set(mockArtworks.map((artwork) => artwork.category)),
).sort();

const MEDIUM_OPTIONS = Array.from(
  new Set(mockArtworks.map((artwork) => artwork.medium)),
).sort();

// Only artists who actually have a marketplace-eligible piece — an artist
// filter full of dead ends would be worse than not having one.
const ARTIST_OPTIONS = Array.from(
  new Map(mockArtworks.map((a) => [a.artistId, a.artistName])).entries(),
)
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

// An artwork has no location of its own — only its artist does
// (types/artist.ts ArtistProfile.location) — so this joins through
// artistId exactly the way filterArtworks() does server-side.
const LOCATION_OPTIONS = Array.from(
  new Set(
    mockArtworks
      .map(
        (a) => mockArtists.find((artist) => artist.id === a.artistId)?.location,
      )
      .filter((loc): loc is string => Boolean(loc)),
  ),
).sort();

const SIZE_OPTIONS: { value: ArtworkSizeBand; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const AVAILABILITY_OPTIONS: {
  value: NonNullable<ArtworkFilters["availability"]>;
  label: string;
}[] = [
  { value: "available", label: "Available now" },
  { value: "unavailable", label: "Reserved / sold" },
];

// Upper bound for the price slider — comfortably above the highest
// customerPrice in the current catalogue (lib/mock-data/artworks.ts tops out
// around ₹1,49,000), rounded for a clean slider scale rather than tied to a
// value that shifts every time a new fixture is added.
const MAX_PRICE_BOUND = 200_000;

// Same solid per-rank colors as the artwork card's corner stamp
// (components/shared/rarity-badge.tsx "stamp" variant) — one rank language
// across the whole marketplace, not a second palette invented for the filter.
const RANK_TONE: Record<ArtworkRarity, string> = {
  R: "bg-destructive text-white",
  U: "bg-emerald-600 text-white",
  O: "bg-gold-deep text-white",
  N: "bg-muted-foreground text-background",
};

export const DEFAULT_MARKETPLACE_FILTERS: ArtworkFilters = { sortBy: "newest" };

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

// Only checks the facets this component itself renders (not `query`, which
// the search bar owns, or `sortBy`, which now lives with the results row) -
// governs whether "Clear All" shows up.
function hasActiveStructuredFilters(filters: ArtworkFilters): boolean {
  return Boolean(
    filters.category ||
    filters.medium ||
    filters.rarity ||
    filters.artistId ||
    filters.location ||
    filters.size ||
    filters.availability ||
    typeof filters.minPrice === "number" ||
    typeof filters.maxPrice === "number",
  );
}

interface MarketplaceFiltersProps {
  filters: ArtworkFilters;
  onChange: (filters: ArtworkFilters) => void;
  className?: string;
}

export function MarketplaceFilters({
  filters,
  onChange,
  className,
}: MarketplaceFiltersProps) {
  const minId = useId();
  const maxId = useId();

  // Fixed totals per rank across the live catalogue — the reference board's
  // own counts (6/7/5/4) are exactly this: how many of each rank exist, not
  // how many match the other filters currently active. Recomputing a live
  // per-combination count is a full facet-search engine this app doesn't
  // have anywhere else yet.
  const rankCounts = useMemo(() => {
    const counts: Record<ArtworkRarity, number> = { R: 0, U: 0, O: 0, N: 0 };
    for (const artwork of mockArtworks) {
      if (artwork.status === "marketplace" && artwork.rarityType) {
        counts[artwork.rarityType] += 1;
      }
    }
    return counts;
  }, []);

  function update(patch: Partial<ArtworkFilters>) {
    onChange({ ...filters, ...patch });
  }

  const minPrice = filters.minPrice ?? 0;
  const maxPrice = filters.maxPrice ?? MAX_PRICE_BOUND;
  const minPct = (minPrice / MAX_PRICE_BOUND) * 100;
  const maxPct = (maxPrice / MAX_PRICE_BOUND) * 100;

  return (
    <aside
      className={cn(
        "flex h-fit max-h-[calc(100vh-6rem)] w-full flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card/60 p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
          <Filter className="size-4 text-gold-bright" strokeWidth={1.75} />
          Filters
        </h2>
        {hasActiveStructuredFilters(filters) && (
          <button
            type="button"
            onClick={() =>
              onChange({ ...DEFAULT_MARKETPLACE_FILTERS, query: filters.query })
            }
            className="text-xs font-medium text-gold-bright hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      <Accordion type="multiple" className="gap-0">
        <SelectFilterGroup
          value="type"
          icon={Shapes}
          label="Art Type"
          allLabel="All Art Types"
          current={filters.category ? titleCase(filters.category) : null}
          selectValue={filters.category ?? ALL_VALUE}
          onSelectChange={(value) =>
            update({ category: value !== ALL_VALUE ? value : undefined })
          }
        >
          {CATEGORY_OPTIONS.map((category) => (
            <SelectItem key={category} value={category}>
              {titleCase(category)}
            </SelectItem>
          ))}
        </SelectFilterGroup>

        <SelectFilterGroup
          value="medium"
          icon={Palette}
          label="Medium"
          allLabel="All Mediums"
          current={filters.medium}
          selectValue={filters.medium ?? ALL_VALUE}
          onSelectChange={(value) =>
            update({ medium: value !== ALL_VALUE ? value : undefined })
          }
        >
          {MEDIUM_OPTIONS.map((medium) => (
            <SelectItem key={medium} value={medium}>
              {medium}
            </SelectItem>
          ))}
        </SelectFilterGroup>

        <AccordionItem value="rank">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <Star className="size-4 text-muted-foreground" strokeWidth={1.75} />
              Rank
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-2.5">
              {ARTWORK_RARITY_OPTIONS.map((option) => {
                const checked = filters.rarity === option.value;
                return (
                  <label
                    key={option.value}
                    className="grid cursor-pointer grid-cols-[auto_auto_1fr_auto] items-center gap-3 w-full"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        update({ rarity: checked ? undefined : option.value })
                      }
                    />
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                        RANK_TONE[option.value],
                      )}
                    >
                      {option.value}
                    </span>
                    <span className="text-sm text-foreground">
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground text-right">
                      {rankCounts[option.value]}
                    </span>
                  </label>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price">
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <IndianRupee
                className="size-4 text-muted-foreground"
                strokeWidth={1.75}
              />
              Price Range (₹)
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input
                  id={minId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Min"
                  value={filters.minPrice ?? ""}
                  onChange={(e) =>
                    update({
                      minPrice:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  className="h-9"
                />
                <span className="text-sm text-muted-foreground" aria-hidden="true">
                  to
                </span>
                <Input
                  id={maxId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Max"
                  value={filters.maxPrice ?? ""}
                  onChange={(e) =>
                    update({
                      maxPrice:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  className="h-9"
                />
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-muted-foreground">
                  ₹{minPrice.toLocaleString("en-IN")}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  ₹{maxPrice.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="relative h-1.5 rounded-full bg-secondary">
                <div
                  className="absolute h-full rounded-full bg-gold"
                  style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
                  aria-hidden="true"
                />
                <input
                  type="range"
                  aria-label="Minimum price"
                  min={0}
                  max={MAX_PRICE_BOUND}
                  step={1000}
                  value={minPrice}
                  onChange={(e) => {
                    const next = Math.min(Number(e.target.value), maxPrice);
                    update({ minPrice: next > 0 ? next : undefined });
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold-deep [&::-moz-range-thumb]:bg-background [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold-deep [&::-webkit-slider-thumb]:bg-background pointer-events-none"
                />
                <input
                  type="range"
                  aria-label="Maximum price"
                  min={0}
                  max={MAX_PRICE_BOUND}
                  step={1000}
                  value={maxPrice}
                  onChange={(e) => {
                    const next = Math.max(Number(e.target.value), minPrice);
                    update({
                      maxPrice: next < MAX_PRICE_BOUND ? next : undefined,
                    });
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold-deep [&::-moz-range-thumb]:bg-background [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold-deep [&::-webkit-slider-thumb]:bg-background pointer-events-none"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <SelectFilterGroup
          value="size"
          icon={Ruler}
          label="Size"
          allLabel="All Sizes"
          current={
            filters.size
              ? SIZE_OPTIONS.find((o) => o.value === filters.size)?.label
              : null
          }
          selectValue={filters.size ?? ALL_VALUE}
          onSelectChange={(value) =>
            update({
              size:
                value !== ALL_VALUE ? (value as ArtworkSizeBand) : undefined,
            })
          }
        >
          {SIZE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectFilterGroup>

        <SelectFilterGroup
          value="artist"
          icon={User}
          label="Artist"
          allLabel="All Artists"
          current={
            filters.artistId
              ? ARTIST_OPTIONS.find((a) => a.id === filters.artistId)?.name
              : null
          }
          selectValue={filters.artistId ?? ALL_VALUE}
          onSelectChange={(value) =>
            update({ artistId: value !== ALL_VALUE ? value : undefined })
          }
        >
          {ARTIST_OPTIONS.map((artist) => (
            <SelectItem key={artist.id} value={artist.id}>
              {artist.name}
            </SelectItem>
          ))}
        </SelectFilterGroup>

        <SelectFilterGroup
          value="location"
          icon={MapPin}
          label="Location"
          allLabel="All Locations"
          current={filters.location}
          selectValue={filters.location ?? ALL_VALUE}
          onSelectChange={(value) =>
            update({ location: value !== ALL_VALUE ? value : undefined })
          }
        >
          {LOCATION_OPTIONS.map((location) => (
            <SelectItem key={location} value={location}>
              {location}
            </SelectItem>
          ))}
        </SelectFilterGroup>

        <SelectFilterGroup
          value="availability"
          icon={CircleCheck}
          label="Availability"
          allLabel="All"
          current={
            filters.availability
              ? AVAILABILITY_OPTIONS.find((o) => o.value === filters.availability)
                  ?.label
              : null
          }
          selectValue={filters.availability ?? ALL_VALUE}
          onSelectChange={(value) =>
            update({
              availability:
                value !== ALL_VALUE
                  ? (value as ArtworkFilters["availability"])
                  : undefined,
            })
          }
          isLast
        >
          {AVAILABILITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectFilterGroup>
      </Accordion>

      <button
        type="button"
        onClick={() =>
          onChange({ ...DEFAULT_MARKETPLACE_FILTERS, query: filters.query })
        }
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:border-gold/50 hover:text-gold-bright"
      >
        <RotateCcw className="size-3.5" strokeWidth={1.75} />
        Reset Filters
      </button>
    </aside>
  );
}

// The six filter groups that are "just a Select" (Art Type, Medium, Size,
// Artist, Location, Availability) share one shape: an icon+label trigger
// with the current selection shown as a subtitle even while collapsed
// (matching the reference board), and a Select in the panel. Rank
// (checkboxes) and Price Range (slider) don't fit this shape, so they stay
// hand-written above instead of being forced through this component.
function SelectFilterGroup({
  value,
  icon: Icon,
  label,
  allLabel,
  current,
  selectValue,
  onSelectChange,
  children,
  isLast = false,
}: {
  value: string;
  icon: typeof Shapes;
  label: string;
  allLabel: string;
  current?: string | null;
  selectValue: string;
  onSelectChange: (value: string) => void;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <AccordionItem value={value} className={isLast ? "border-b-0" : undefined}>
      <AccordionTrigger>
        <span className="flex flex-col items-start gap-0.5">
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
            {label}
          </span>
          <span className="pl-6 text-xs font-normal text-muted-foreground">
            {current || allLabel}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <Select value={selectValue} onValueChange={(v) => onSelectChange(v ?? ALL_VALUE)}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder={allLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
            {children}
          </SelectContent>
        </Select>
      </AccordionContent>
    </AccordionItem>
  );
}
