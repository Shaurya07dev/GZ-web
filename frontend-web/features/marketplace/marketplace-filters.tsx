"use client";

import { useId } from "react";
import {
  RotateCcw,
  Shapes,
  Palette,
  Star,
  IndianRupee,
  ArrowUpDown,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { mockArtworks } from "@/lib/mock-data/artworks";
import {
  ARTWORK_RARITY_OPTIONS,
  type ArtworkFilters,
  type ArtworkRarity,
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

const SORT_OPTIONS: {
  value: NonNullable<ArtworkFilters["sortBy"]>;
  label: string;
}[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export const DEFAULT_MARKETPLACE_FILTERS: ArtworkFilters = { sortBy: "newest" };

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

// Only checks the facets this component itself renders (not `query`, which
// the search bar owns) - governs whether the inline "Reset" affordance
// shows up.
function hasActiveStructuredFilters(filters: ArtworkFilters): boolean {
  return Boolean(
    filters.category ||
    filters.medium ||
    filters.rarity ||
    typeof filters.minPrice === "number" ||
    typeof filters.maxPrice === "number" ||
    (filters.sortBy && filters.sortBy !== "newest"),
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

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shapes className="size-3.5" strokeWidth={1.75} />
          Category
        </Label>
        <Select
          value={filters.category ?? ALL_VALUE}
          onValueChange={(value) =>
            onChange({
              ...filters,
              category: value && value !== ALL_VALUE ? value : undefined,
            })
          }
        >
          <SelectTrigger className="h-10 w-[152px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All categories</SelectItem>
            {CATEGORY_OPTIONS.map((category) => (
              <SelectItem key={category} value={category}>
                {titleCase(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Palette className="size-3.5" strokeWidth={1.75} />
          Medium
        </Label>
        <Select
          value={filters.medium ?? ALL_VALUE}
          onValueChange={(value) =>
            onChange({
              ...filters,
              medium: value && value !== ALL_VALUE ? value : undefined,
            })
          }
        >
          <SelectTrigger className="h-10 w-[176px]">
            <SelectValue placeholder="All mediums" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All mediums</SelectItem>
            {MEDIUM_OPTIONS.map((medium) => (
              <SelectItem key={medium} value={medium}>
                {medium}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="size-3.5" strokeWidth={1.75} />
          Rank
        </Label>
        <Select
          value={filters.rarity ?? ALL_VALUE}
          onValueChange={(value) =>
            onChange({
              ...filters,
              rarity:
                value && value !== ALL_VALUE
                  ? (value as ArtworkRarity)
                  : undefined,
            })
          }
        >
          <SelectTrigger className="h-10 w-[152px]">
            <SelectValue placeholder="Any rank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Any rank</SelectItem>
            {ARTWORK_RARITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="font-semibold">{option.value}</span>
                <span className="ml-1.5">{option.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor={minId}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <IndianRupee className="size-3.5" strokeWidth={1.75} />
          Price range
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={minId}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Min"
            value={filters.minPrice ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                minPrice:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className="h-10 w-[92px]"
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
              onChange({
                ...filters,
                maxPrice:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            className="h-10 w-[92px]"
          />
        </div>
      </div>

      <div className="ml-auto flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUpDown className="size-3.5" strokeWidth={1.75} />
          Sort by
        </Label>
        <Select
          value={filters.sortBy ?? "newest"}
          onValueChange={(value) =>
            onChange({
              ...filters,
              sortBy: (value as ArtworkFilters["sortBy"]) ?? "newest",
            })
          }
        >
          <SelectTrigger className="h-10 w-[184px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveStructuredFilters(filters) && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...DEFAULT_MARKETPLACE_FILTERS, query: filters.query })
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-gold-bright"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.75} />
          Reset
        </button>
      )}
    </div>
  );
}
