"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, GalleryVerticalEnd, ShieldOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceTag } from "@/components/shared/price-tag";
import { ArtworkPassportCard } from "@/features/verify/artwork-passport-card";
import { ExpiryCountdown } from "./expiry-countdown";
import { CycleStepper } from "./cycle-stepper";
import { RecordSaleDialog } from "./record-sale-dialog";
import { ReturnHoldingDialog } from "./return-holding-dialog";
import { HOLDING_STATUS_CONFIG } from "./holding-status";
import {
  useAggregatorHolding,
} from "@/hooks/useAggregatorCollection";
import { useReservableInventory } from "@/hooks/useAggregatorInventory";
import { AGGREGATOR_CYCLE_MONTHS } from "@/lib/pricing";
import { formatINR } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The "what happens next" screen the old confirm-dialog flow never had: one
// holding's full lifecycle in one place — price breakdown, expiry, the
// COA/NFC passport while it's actively yours, and what to do when a period
// ends. Reserve (reserve-artwork-page.tsx) lands here on success; the
// Inventory row (CollectionTable) links here too, so both paths meet at the
// same page.
export function HoldingDetail({ holdingId }: { holdingId: string }) {
  const { data: holding, isPending, isError } = useAggregatorHolding(holdingId);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  // Snapshotted once (react-hooks/purity forbids a bare Date.now() in render
  // — see expiry-countdown.tsx). Only used to notice "the window has already
  // passed" for the banner below; a stale-by-a-few-seconds value doesn't
  // matter for that.
  const [now] = useState(() => Date.now());

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !holding) {
    return (
      <EmptyState
        icon={GalleryVerticalEnd}
        title="Holding not found"
        description="This reservation may have been removed, or the link is wrong."
        action={
          <Link
            href="/aggregator/collection"
            className="text-sm font-medium text-gold-bright hover:underline"
          >
            Back to My Inventory
          </Link>
        }
      />
    );
  }

  const { artwork } = holding;
  const status = HOLDING_STATUS_CONFIG[holding.status];
  const isReserved = holding.status === "reserved";
  const isReturned = holding.status === "returned";
  // Nothing in this mock ever auto-expires a placement — there's no
  // background job, so a piece past its 30 days just sits "Reserved" showing
  // a red countdown until the aggregator does something about it. This
  // banner is that "something about it" prompt; Return/Record sale below are
  // the two ways it actually resolves.
  const isExpired =
    isReserved && new Date(holding.expiresAt).getTime() <= now;
  // The note's rule: COA/NFC access follows the ACTIVE allocation. Once a
  // piece is returned it moves on to the next aggregator, so the passport
  // stops showing here — it isn't deleted, just no longer this aggregator's
  // to see (types/artwork.ts's coa fields live permanently on the artwork).
  const showPassport = !isReturned;


  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href="/aggregator/collection"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-gold-bright"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Back to My Inventory
      </Link>

      {isExpired && (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              This piece&rsquo;s 30-day display window has passed.
            </p>
            <p className="text-sm text-muted-foreground">
              Nothing happens on its own — record the sale if it sold, or
              return it so GalleryZone can offer it to another aggregator at
              next month&rsquo;s price.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={() => setSaleDialogOpen(true)}>
              Record sale
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReturnDialogOpen(true)}
            >
              Return
            </Button>
          </div>
        </div>
      )}

      {isReturned && (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">
            Your period for this piece has ended.
          </p>
          <p className="text-sm text-muted-foreground">
            It has gone back to GalleryZone and is now available to another
            aggregator.{" "}
            <Link
              href="/aggregator/inventory"
              className="font-medium text-gold-bright hover:underline"
            >
              Browse inventory
            </Link>{" "}
            to reserve something else.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
            <Image
              src={artwork.thumbnailUrl}
              alt={artwork.title}
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold text-foreground">
              {artwork.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {artwork.artistName}
            </p>
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
            >
              <status.icon className="size-3" strokeWidth={2} />
              {status.label}
            </span>
          </div>
          <PriceTag amount={holding.displayPrice} className="text-lg" />
        </div>

        {isReserved && (
          <div className="flex flex-col gap-2.5 border-t border-border pt-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Display window
            </p>
            <ExpiryCountdown expiresAt={holding.expiresAt} className="w-40" />
            <p className="text-xs text-muted-foreground">
              Reserved {formatDate(holding.assignedAt)} &middot; expires{" "}
              {formatDate(holding.expiresAt)}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Rotation &middot; month {holding.cycleMonth ?? 1} of{" "}
            {AGGREGATOR_CYCLE_MONTHS}
          </p>
          <CycleStepper currentMonth={holding.cycleMonth ?? 1} />
        </div>

        <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Advance</p>
            <p className="mt-0.5 font-medium text-foreground tabular-nums">
              {formatINR(holding.advanceAmount)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({holding.advancePercent}%)
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Delivery deposit</p>
            <p className="mt-0.5 font-medium text-foreground tabular-nums">
              {formatINR(holding.deliveryDeposit ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Display price</p>
            <p className="mt-0.5 font-medium text-foreground tabular-nums">
              {formatINR(holding.displayPrice)}
            </p>
          </div>
        </div>

        {isReserved && (
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button onClick={() => setSaleDialogOpen(true)}>
              Record sale
            </Button>
            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(true)}
            >
              Return
            </Button>
          </div>
        )}
      </div>

      {showPassport ? (
        <ArtworkPassportCard
          title={artwork.title}
          artistName={artwork.artistName}
          coverImageUrl={artwork.thumbnailUrl}
          coaCertificateNumber={artwork.coaCertificateNumber}
          coaIssueDate={artwork.coaIssueDate}
        />
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <ShieldOff className="size-4 shrink-0" strokeWidth={1.75} />
          This piece&rsquo;s COA/NFC passport is only visible while it&rsquo;s
          in your active inventory.
        </div>
      )}

      <SimilarArtworks category={artwork.category} excludeId={artwork.id} />

      <RecordSaleDialog
        holding={holding}
        open={saleDialogOpen}
        onOpenChange={setSaleDialogOpen}
      />

      <ReturnHoldingDialog
        holding={holding}
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
      />
    </div>
  );
}

// "Suggestion based search" from the note: same-category pieces still open
// for reservation, so a returned or sold holding still gives the aggregator
// somewhere to go next. Plain category match, no ranking model — the
// reservable list is already small enough that anything cleverer is
// speculative for what this needs to do.
function SimilarArtworks({
  category,
  excludeId,
}: {
  category: string;
  excludeId: string;
}) {
  const { data } = useReservableInventory();
  const similar = (data ?? [])
    .filter((a) => a.category === category && a.id !== excludeId)
    .slice(0, 4);

  if (similar.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Similar artworks
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {similar.map((artwork) => (
          <Link
            key={artwork.id}
            href={`/aggregator/inventory/${artwork.id}/reserve`}
            className="flex flex-col gap-1.5 rounded-lg border border-border p-2 transition-colors hover:border-gold/50"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-muted">
              <Image
                src={artwork.thumbnailUrl}
                alt={artwork.title}
                fill
                sizes="(min-width: 640px) 20vw, 45vw"
                className="object-cover"
              />
            </div>
            <p className="truncate text-xs font-medium text-foreground">
              {artwork.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
