"use client";

import { Star } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { useArtistRating } from "@/hooks/useArtistRating";
import { useArtistAccountProfile } from "@/hooks/useArtistAccount";
import { useArtistDashboardArtworks } from "@/hooks/useArtistArtworks";
import { CURRENT_ARTIST_ID } from "@/lib/mock-collections";
import {
  STAR_VALUES,
  artworkCountScore,
  profileCompletionScore,
  scoreArtist,
  type StarRating as Stars,
} from "@/types/artist-rating";

// The artist's own rating, on their dashboard. Buyers leave a rating after a
// delivered order; this is the read side of that — there is no backend yet, so
// the reviews are seeded rather than collected (see lib/mock-data/
// artist-rating.ts). Admin sees the same numbers for every artist in the
// Artists table.
//
// This card shows the 0-10 composite score (see scoreArtist() in
// types/artist-rating.ts, PLACEHOLDER weights pending client sign-off) —
// customer ratings, profile completion and artwork count combined. Latest
// Reviews was removed from this card per the client's note; the review text
// itself is untouched in mock data, just not surfaced here.

export function RatingCard() {
  const { data: rating } = useArtistRating(CURRENT_ARTIST_ID);
  const { data: profile } = useArtistAccountProfile();
  const { data: artworks } = useArtistDashboardArtworks();

  if (!rating || !profile || !artworks) {
    return (
      <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
    );
  }

  const factors = {
    customerRating: rating.average * 2,
    profileCompletion: profileCompletionScore(profile),
    artworkCount: artworkCountScore(artworks.length),
  };
  const composite = scoreArtist(factors);

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-foreground">
          Your rating
        </h2>
        <span className="text-xs text-muted-foreground">
          {rating.count === 0
            ? "No ratings yet"
            : `${rating.count} ${rating.count === 1 ? "rating" : "ratings"}`}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <p className="font-display text-4xl leading-none font-semibold text-gold-bright tabular-nums">
          {composite.toFixed(1)}
        </p>
        <div className="flex flex-col gap-1">
          <StarRating value={composite / 2} />
          <p className="text-xs text-muted-foreground">out of 10</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {(
          [
            { label: "Customer rating", value: factors.customerRating },
            { label: "Profile completion", value: factors.profileCompletion },
            { label: "Artworks posted", value: factors.artworkCount },
          ] as const
        ).map((factor) => (
          <div key={factor.label} className="flex items-center gap-2.5">
            <span className="w-32 shrink-0 text-xs text-muted-foreground">
              {factor.label}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-gold-bright"
                style={{ width: `${(factor.value / 10) * 100}%` }}
              />
            </span>
            <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
              {factor.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {rating.count === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-border py-6 text-center">
          <Star className="size-6 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            Buyers can rate you once an order is delivered. Your first rating
            will show here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Customer rating breakdown
          </p>
          {STAR_VALUES.map((star: Stars) => {
            const count = rating.breakdown[star];
            const share = rating.count > 0 ? (count / rating.count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2.5">
                <span className="w-3 text-right text-xs text-muted-foreground tabular-nums">
                  {star}
                </span>
                <Star
                  className="size-3 fill-muted-foreground/40 text-muted-foreground/40"
                  strokeWidth={1.5}
                />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-gold-bright"
                    style={{ width: `${share}%` }}
                  />
                </span>
                <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
