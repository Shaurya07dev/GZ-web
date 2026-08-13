"use client";

import "@/lib/motion-config";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  CircleCheckBig,
  Heart,
  Lock,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/store/useWishlistStore";
import { PriceTag } from "@/components/shared/price-tag";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import type { ArtworkStatus, ArtworkSummary } from "@/types/artwork";

interface ArtworkCardProps {
  artwork: ArtworkSummary;
  className?: string;
}

// Only "reserved" and "sold" ever occur as a live status on a marketplace
// fixture (see lib/mock-data/artworks.ts) — every other ArtworkStatus value
// exists only as a statusHistory entry, never as the artwork's *current*
// status. The fallback below keeps this honest and non-broken if that ever
// changes rather than assuming only two statuses are possible.
const STATUS_BADGE: Partial<Record<ArtworkStatus, { label: string; icon: LucideIcon }>> = {
  reserved: { label: "Reserved", icon: BookmarkCheck },
  sold: { label: "Sold", icon: CircleCheckBig },
};

// ArtworkSummary only carries a boolean `verifiedArtist`, not the artist's
// full ArtistVerificationState (that lives on ArtistProfile, one level up,
// which the card grid doesn't fetch). A confirmed-true boolean means "at
// least tier 1" by construction (see mock-data/artworks.ts:
// verifiedArtist = verifiedTierCount(artist.verification) > 0), so this is
// a faithful lower bound, not invented data — it will never render the Gold
// treatment from a boolean alone, only ever the subtler tier-1 "Verified"
// mark. The real tier count (and possible Gold badge) renders correctly
// wherever the full ArtistProfile is available, e.g. the Artist Profile
// page.
const MINIMUM_VERIFICATION = {
  tier1SocialMedia: true,
  tier2ActivePlan: false,
  tier3FirstSale: false,
} as const;

export function ArtworkCard({ artwork, className }: ArtworkCardProps) {
  const isWishlisted = useWishlistStore((state) => state.has(artwork.id));
  const toggleWishlist = useWishlistStore((state) => state.toggle);

  const isAvailable = artwork.status === "marketplace";
  const statusBadge = isAvailable
    ? null
    : (STATUS_BADGE[artwork.status] ?? { label: "Unavailable", icon: Lock });
  const StatusIcon = statusBadge?.icon;

  return (
    <Link
      href={`/marketplace/${artwork.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-[border-color,transform] duration-200 ease-out hover:border-gold/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <Image
          src={artwork.thumbnailUrl}
          alt={artwork.title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className={cn(
            "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]",
            !isAvailable && "opacity-75 grayscale-[55%]"
          )}
        />

        {statusBadge && StatusIcon && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            <StatusIcon className="size-3" strokeWidth={2} />
            {statusBadge.label}
          </span>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(artwork.id);
          }}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={isWishlisted}
          className="absolute top-2.5 right-2.5 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground/75 backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Heart
            className={cn(
              "size-4 transition-colors",
              isWishlisted && "fill-gold-bright text-gold-bright"
            )}
            strokeWidth={1.75}
          />
        </motion.button>

        {artwork.insured && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full border border-gold/40 bg-background/90 px-2 py-1 text-[11px] font-medium text-gold-bright backdrop-blur-sm">
            <ShieldCheck className="size-3" strokeWidth={2} />
            Insured
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-2 font-display text-sm leading-snug font-semibold text-foreground">
          {artwork.title}
        </h3>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{artwork.artistName}</span>
          {artwork.verifiedArtist && (
            <VerifiedBadge verification={MINIMUM_VERIFICATION} size="sm" />
          )}
        </div>
        <PriceTag amount={artwork.customerPrice} className="mt-1 text-base" />
      </div>
    </Link>
  );
}
