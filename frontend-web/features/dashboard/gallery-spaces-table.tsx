"use client";

import { useState } from "react";
import Image from "next/image";
import {
  BookmarkCheck,
  CircleCheckBig,
  Undo2,
  GalleryVerticalEnd,
  CalendarRange,
  Loader2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceTag } from "@/components/shared/price-tag";
import { ShipmentTracker } from "@/components/shared/shipment-tracker";
import { ExpiryCountdown } from "@/features/aggregator/expiry-countdown";
import { useArtistGallerySpaces } from "@/hooks/useArtistGallerySpaces";
import { artistDashboardService } from "@/services/artistDashboardService";
import { formatINR } from "@/lib/utils";
import type { AggregatorHolding } from "@/types/aggregator";

const STATUS_CONFIG: Record<
  AggregatorHolding["status"],
  { label: string; icon: typeof BookmarkCheck; className: string }
> = {
  reserved: {
    label: "With aggregator",
    icon: BookmarkCheck,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  sold_pending_settlement: {
    label: "Sold, pending settlement",
    icon: CircleCheckBig,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  returned: {
    label: "Returned",
    icon: Undo2,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

// ₹200 default — same as the backend rate (artistReturnShippingPaise).
// Displayed in the dialog so the artist knows what's getting deducted; the
// authoritative amount still comes from the POST response.
const DEFAULT_RETURN_SHIPPING_FEE = 200;

export function GallerySpacesTable() {
  const { data, isPending, isError } = useArtistGallerySpaces();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);

  const requestReturn = useMutation({
    mutationFn: (artworkId: string) =>
      artistDashboardService.requestArtworkReturn(artworkId),
    onSuccess: ({ returnShippingDuePaise }) => {
      toast.success(
        `Return requested. ${formatINR(returnShippingDuePaise / 100)} return shipping will be deducted from your next payout.`,
      );
      setConfirming(null);
      queryClient.invalidateQueries({ queryKey: ["artist-gallery-spaces"] });
    },
    onError: (e) => {
      // Backend's too_early / no_active_holding codes land here as an
      // Error whose message is the problem+json title. The server already
      // sent a human-readable message; relay it directly.
      toast.error(e instanceof Error ? e.message : "Couldn't raise the return");
    },
  });

  const confirmingHolding = confirming ? data?.find((h) => h.id === confirming) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Aggregator display
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Where your work is physically on display right now.
          </p>
        </div>

        {/* Your artwork is with GalleryZone for a six-month listing period —
            not a fixed month-per-location schedule. Locations can change
            within that period; this page always shows the current one. */}
        <div className="flex items-start gap-3 rounded-lg border border-gold/25 bg-gold/5 p-4">
          <CalendarRange
            className="mt-0.5 size-4 shrink-0 text-gold-bright"
            strokeWidth={1.75}
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            You send your artwork for a{" "}
            <span className="font-medium text-foreground">
              six-month listing period
            </span>
            . Within it, GalleryZone places the piece with an aggregator for
            display and may move it to another one if it hasn&rsquo;t sold —
            you don&rsquo;t commit to a location for a fixed month. Whatever
            the current placement is, it shows here.
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={GalleryVerticalEnd}
          title="Couldn't load your aggregator display"
          description="Something went wrong. Try refreshing the page."
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={GalleryVerticalEnd}
          title="No pieces with an aggregator yet"
          description="Artworks listed on the aggregator channel show up here once an aggregator reserves one."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-4 py-3 font-medium">Artwork</th>
                <th className="px-4 py-3 font-medium">Display price</th>
                <th className="px-4 py-3 font-medium">Shipping</th>
                <th className="px-4 py-3 font-medium">At this location until</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {/* Only visible once any holding on the page is past its
                    6-month listing window — avoids a column of em-dashes
                    on fresh placements. */}
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((holding) => {
                const isSold = holding.status === "sold_pending_settlement";
                const status = STATUS_CONFIG[holding.status];
                return (
                  <tr
                    key={holding.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                          <Image
                            src={holding.artwork.thumbnailUrl}
                            alt={holding.artwork.title}
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        </div>
                        <p className="truncate font-medium text-foreground">
                          {holding.artwork.title}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <PriceTag amount={holding.displayPrice} className="text-sm" showGstNote />
                    </td>

                    <td className="px-4 py-3.5">
                      <ShipmentTracker
                        stage={holding.inboundShiprocketStage ?? null}
                        trackingId={holding.inboundTrackingId}
                        carrier={holding.inboundCarrier}
                      />
                    </td>

                    <td className="px-4 py-3.5">
                      {isSold ? (
                        <span className="text-xs text-muted-foreground">
                          &mdash;
                        </span>
                      ) : (
                        <ExpiryCountdown
                          expiresAt={holding.expiresAt}
                          className="w-32"
                        />
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${status.className}`}
                      >
                        <status.icon className="size-3" strokeWidth={2} />
                        {status.label}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      {holding.artistReturnRequestedAt ? (
                        <span className="text-xs text-muted-foreground">
                          Return requested
                        </span>
                      ) : holding.canRequestArtistReturn ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirming(holding.id)}
                        >
                          Request return
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          &mdash;
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !requestReturn.isPending) setConfirming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request your piece back?</DialogTitle>
            <DialogDescription>
              The current aggregator will be asked to hand &ldquo;
              {confirmingHolding?.artwork?.title ?? "this piece"}&rdquo; back to
              you. GalleryZone books the return pickup; the return-shipping fee
              (about {formatINR(DEFAULT_RETURN_SHIPPING_FEE)}) is deducted from
              your next payout.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirming(null)}
              disabled={requestReturn.isPending}
            >
              Not yet
            </Button>
            <Button
              onClick={() => {
                if (confirmingHolding) {
                  requestReturn.mutate(confirmingHolding.artworkId);
                }
              }}
              disabled={requestReturn.isPending}
            >
              {requestReturn.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Requesting
                </>
              ) : (
                "Request return"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
