"use client";

import { Star } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { useArtistRating, useArtistReviews } from "@/hooks/useArtistNetwork";
import { CURRENT_ARTIST_ID } from "@/lib/mock-collections";
import { STAR_VALUES, type StarRating as Stars } from "@/types/artist-network";

// The artist's own rating, on their dashboard. Buyers leave a rating after a
// delivered order; this is the read side of that — there is no backend yet, so
// the reviews are seeded rather than collected (see lib/mock-data/
// artist-network.ts). Admin sees the same numbers for every artist in the
// Artists table.

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RatingCard() {
  const { data: rating } = useArtistRating(CURRENT_ARTIST_ID);
  const { data: reviews } = useArtistReviews(CURRENT_ARTIST_ID);

  if (!rating) {
    return (
      <div className="h-72 animate-pulse rounded-lg border border-border bg-card" />
    );
  }

  const latest = (reviews ?? []).slice(0, 3);

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

      {rating.count === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Star className="size-6 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            Buyers can rate you once an order is delivered. Your first rating
            will show here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <p className="font-display text-4xl leading-none font-semibold text-gold-bright tabular-nums">
              {rating.average.toFixed(1)}
            </p>
            <div className="flex flex-col gap-1">
              <StarRating value={rating.average} />
              <p className="text-xs text-muted-foreground">out of 5</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
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

          {latest.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Latest reviews
              </p>
              {latest.map((review) => (
                <div key={review.id} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={review.rating} size="sm" />
                    <span className="text-sm font-medium text-foreground">
                      {review.reviewerName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{review.comment}&rdquo;
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    on {review.artworkTitle}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
