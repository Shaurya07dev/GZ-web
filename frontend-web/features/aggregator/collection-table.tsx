"use client";

import { useState } from "react";
import Image from "next/image";
import {
  BookmarkCheck,
  CircleCheckBig,
  Undo2,
  GalleryVerticalEnd,
  Pencil,
  Lock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceTag } from "@/components/shared/price-tag";
import { ExpiryCountdown } from "./expiry-countdown";
import { EditDisplayPriceDialog } from "./edit-display-price-dialog";
import { RecordSaleDialog } from "./record-sale-dialog";
import {
  useAggregatorCollection,
  useReleaseHoldingMutation,
} from "@/hooks/useAggregatorCollection";
import { formatINR } from "@/lib/utils";
import { canSetDisplayPrice } from "@/lib/pricing";
import { toast } from "sonner";
import type { AggregatorHolding } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";

type CollectionRow = AggregatorHolding & { artwork: ArtworkSummary };

const STATUS_CONFIG: Record<
  AggregatorHolding["status"],
  { label: string; icon: typeof BookmarkCheck; className: string }
> = {
  reserved: {
    label: "Reserved",
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

export function CollectionTable() {
  const { data, isPending, isError } = useAggregatorCollection();
  const [priceDialogHolding, setPriceDialogHolding] =
    useState<CollectionRow | null>(null);
  const [saleDialogHolding, setSaleDialogHolding] =
    useState<CollectionRow | null>(null);
  const releaseMutation = useReleaseHoldingMutation();

  // Returning an unsold piece refunds the advance but NOT the delivery charge
  // — the money-flow sheet settles delivery only on a sale. That costs real
  // money, so it is spelled out before the click rather than after it.
  function handleReturn(holding: CollectionRow) {
    const deliveryLost = holding.deliveryDeposit ?? 0;
    const confirmed = window.confirm(
      `Return "${holding.artwork.title}" to GalleryZone?

` +
        `Your ${formatINR(holding.advanceAmount)} advance is released back to your wallet. ` +
        (deliveryLost > 0
          ? `The ${formatINR(deliveryLost)} delivery charge does not — it is only refunded when a piece sells.`
          : ""),
    );
    if (!confirmed) return;
    releaseMutation.mutate(holding.id, {
      onSuccess: ({ refunded, deliveryLost }) =>
        toast.success("Returned to GalleryZone", {
          description:
            `${formatINR(refunded)} advance released.` +
            (deliveryLost > 0
              ? ` ${formatINR(deliveryLost)} delivery was charged.`
              : ""),
        }),
      onError: (error) => toast.error(error.message),
    });
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={GalleryVerticalEnd}
        title="Couldn't load your collection"
        description="Something went wrong loading your holdings. Try refreshing the page."
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={GalleryVerticalEnd}
        title="No holdings yet"
        description="Reserve an artwork from Inventory to see it appear here."
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3 font-medium">Artwork</th>
              <th className="px-4 py-3 font-medium">
                Display price
                <span className="block text-[10px] font-normal normal-case text-muted-foreground/70">
                  Incl. GST
                </span>
              </th>
              <th className="px-4 py-3 font-medium">Expiry</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((holding) => {
              const isSold = holding.status === "sold_pending_settlement";
              // Two different reasons the price can't be touched, and they
              // need different words: you already used your one change, or the
              // price was never yours to set because you aren't the first
              // aggregator to display this piece.
              const canPrice = canSetDisplayPrice(holding.cycleMonth ?? 1);
              const priceLocked = Boolean(holding.displayPriceSetAt) || !canPrice;
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
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {holding.artwork.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {holding.artwork.artistName}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    {/* MOU §6 — one opportunity to set the selling price.
                        Once set it is locked, so the pencil disappears and
                        the cell says why. */}
                    <button
                      type="button"
                      onClick={() =>
                        !isSold &&
                        !priceLocked &&
                        setPriceDialogHolding(holding)
                      }
                      disabled={isSold || priceLocked}
                      title={
                        !canPrice
                          ? "GalleryZone sets the price for this piece — only the first aggregator to display a work can price it"
                          : priceLocked
                            ? "Set once already — the selling price is fixed (MOU §6)"
                            : undefined
                      }
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -ml-1.5 transition-colors enabled:hover:bg-muted disabled:cursor-not-allowed"
                    >
                      <PriceTag
                        amount={holding.displayPrice}
                        className="text-sm"
                      />
                      {!isSold &&
                        (priceLocked ? (
                          <Lock
                            className="size-3 text-muted-foreground"
                            strokeWidth={1.75}
                          />
                        ) : (
                          <Pencil
                            className="size-3 text-muted-foreground"
                            strokeWidth={1.75}
                          />
                        ))}
                    </button>
                    {!isSold && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {!canPrice
                          ? "Set by GalleryZone"
                          : priceLocked
                            ? "Price fixed"
                            : "You can set this once"}
                      </p>
                    )}
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
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isSold ? "outline" : "default"}
                        disabled={isSold}
                        onClick={() => setSaleDialogHolding(holding)}
                      >
                        {isSold ? "Sale recorded" : "Record sale"}
                      </Button>
                      {!isSold && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={releaseMutation.isPending}
                          onClick={() => handleReturn(holding)}
                        >
                          Return
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EditDisplayPriceDialog
        holding={priceDialogHolding}
        open={priceDialogHolding !== null}
        onOpenChange={(open) => !open && setPriceDialogHolding(null)}
      />

      <RecordSaleDialog
        holding={saleDialogHolding}
        open={saleDialogHolding !== null}
        onOpenChange={(open) => !open && setSaleDialogHolding(null)}
      />
    </>
  );
}
