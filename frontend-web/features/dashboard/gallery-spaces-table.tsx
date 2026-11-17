"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useArtistAccountProfile } from "@/hooks/useArtistAccount";
import {
  artistDashboardService,
  type ReturnQuote,
} from "@/services/artistDashboardService";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
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

export function GallerySpacesTable() {
  const { data, isPending, isError } = useArtistGallerySpaces();
  const { data: profile } = useArtistAccountProfile();
  const queryClient = useQueryClient();
  const [returning, setReturning] = useState<string | null>(null);
  const returningHolding = returning ? data?.find((h) => h.id === returning) : undefined;

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
                          onClick={() => setReturning(holding.id)}
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

      {returningHolding ? (
        <ReturnDialog
          holding={returningHolding}
          defaultDrop={{
            name: profile?.fullName ?? "",
            phone: profile?.phone ?? "",
            line1: profile?.pickupLine1 ?? "",
            line2: profile?.pickupLine2 ?? "",
            city: profile?.pickupCity ?? "",
            state: profile?.pickupState ?? "",
            pincode: profile?.pickupPincode ?? "",
          }}
          onClose={() => setReturning(null)}
          onCompleted={() => {
            queryClient.invalidateQueries({ queryKey: ["artist-gallery-spaces"] });
            setReturning(null);
          }}
        />
      ) : null}
    </div>
  );
}

interface DropAddressForm {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

function ReturnDialog({
  holding,
  defaultDrop,
  onClose,
  onCompleted,
}: {
  holding: AggregatorHolding & { artwork: { title: string } };
  defaultDrop: DropAddressForm;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [step, setStep] = useState<"address" | "pay">("address");
  const [form, setForm] = useState<DropAddressForm>(defaultDrop);
  const [quote, setQuote] = useState<ReturnQuote | null>(null);
  const [paying, setPaying] = useState(false);

  // Keep the form in sync once the artist profile loads in behind us.
  useEffect(() => {
    if (step === "address") setForm(defaultDrop);
  }, [defaultDrop, step]);

  const getQuote = useMutation({
    mutationFn: () =>
      artistDashboardService.requestArtworkReturn(holding.artworkId, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
      }),
    onSuccess: (q) => {
      setQuote(q);
      setStep("pay");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Couldn't get a courier quote");
    },
  });

  const verify = useMutation({
    mutationFn: (payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) =>
      artistDashboardService.verifyArtworkReturn(holding.artworkId, {
        holdingId: holding.id,
        ...payload,
      }),
    onSuccess: () => {
      toast.success("Return booked. The courier will be in touch for pickup.");
      onCompleted();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Couldn't confirm the payment");
    },
  });

  async function pay() {
    if (!quote || !quote.razorpayKeyId) {
      toast.error("Payments aren't configured on this server.");
      return;
    }
    setPaying(true);
    try {
      const outcome = await openRazorpayCheckout({
        mode: "razorpay",
        keyId: quote.razorpayKeyId,
        razorpayOrderId: quote.razorpayOrderId,
        amountPaise: quote.amountPaise,
        currency: quote.currency,
        name: "GalleryZone",
        description: `Return shipping for ${holding.artwork.title}`,
        prefill: {
          name: form.name,
          email: "",
          contact: form.phone,
        },
      });
      if (outcome.success) {
        await verify.mutateAsync({
          razorpayOrderId: outcome.success.razorpay_order_id,
          razorpayPaymentId: outcome.success.razorpay_payment_id,
          razorpaySignature: outcome.success.razorpay_signature,
        });
      } else if (outcome.dismissed) {
        // No toast — the artist can hit "Pay now" again from the same dialog.
      } else if (outcome.failureMessage) {
        toast.error(outcome.failureMessage);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open the payment page");
    } finally {
      setPaying(false);
    }
  }

  const disabled = getQuote.isPending || paying || verify.isPending;
  const canSubmitAddress =
    form.name.trim().length > 0 &&
    form.line1.trim().length > 0 &&
    form.city.trim().length > 0 &&
    form.state.trim().length > 0 &&
    /^\d{6}$/.test(form.pincode.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && !disabled && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request &ldquo;{holding.artwork.title}&rdquo; back</DialogTitle>
          <DialogDescription>
            {step === "address"
              ? "Confirm where the piece should be delivered. We'll quote the courier and take payment before booking."
              : "Review the return-shipping breakdown. Pay to book the courier."}
          </DialogDescription>
        </DialogHeader>

        {step === "address" ? (
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ret-name">Recipient name</Label>
              <Input
                id="ret-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ret-phone">Phone</Label>
              <Input
                id="ret-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="10-digit mobile"
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ret-line1">Address line 1</Label>
              <Input
                id="ret-line1"
                value={form.line1}
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ret-line2">Address line 2 (optional)</Label>
              <Input
                id="ret-line2"
                value={form.line2}
                onChange={(e) => setForm({ ...form, line2: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ret-city">City</Label>
                <Input
                  id="ret-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ret-state">State</Label>
                <Input
                  id="ret-state"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ret-pincode">Pincode</Label>
              <Input
                id="ret-pincode"
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digits"
                disabled={disabled}
              />
            </div>
          </div>
        ) : quote ? (
          <div className="grid gap-3 py-2 text-sm">
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Pickup</p>
              <p className="font-medium text-foreground">
                {quote.pickup.name ?? "Current aggregator"}
              </p>
              <p className="text-xs text-muted-foreground">
                {quote.pickup.line1 ? `${quote.pickup.line1}, ` : ""}
                {quote.pickup.city}
                {quote.pickup.city ? ", " : ""}
                {quote.pickup.state} {quote.pickup.pincode}
              </p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Drop</p>
              <p className="font-medium text-foreground">{quote.drop.name}</p>
              <p className="text-xs text-muted-foreground">
                {quote.drop.line1}
                {quote.drop.line2 ? `, ${quote.drop.line2}` : ""}, {quote.drop.city},{" "}
                {quote.drop.state} {quote.drop.pincode}
              </p>
            </div>

            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 border-t border-border/60 pt-3">
              <dt className="text-muted-foreground">
                Courier ({quote.carrier})
                {quote.estimatedDeliveryDays != null
                  ? ` · ~${quote.estimatedDeliveryDays}d`
                  : ""}
              </dt>
              <dd className="tabular-nums text-foreground">
                {formatINR(quote.breakdown.shippingBasePaise / 100)}
              </dd>
              <dt className="text-muted-foreground">Payment gateway fee (2%)</dt>
              <dd className="tabular-nums text-foreground">
                {formatINR(quote.breakdown.convenienceFeePaise / 100)}
              </dd>
              <dt className="text-muted-foreground">GST on gateway fee (18%)</dt>
              <dd className="tabular-nums text-foreground">
                {formatINR(quote.breakdown.convenienceGstPaise / 100)}
              </dd>
              <dt className="border-t border-border/60 pt-2 font-medium text-foreground">
                Total
              </dt>
              <dd className="border-t border-border/60 pt-2 tabular-nums font-semibold text-foreground">
                {formatINR(quote.breakdown.totalPaise / 100)}
              </dd>
            </dl>
          </div>
        ) : null}

        <DialogFooter>
          {step === "address" ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={disabled}>
                Cancel
              </Button>
              <Button
                onClick={() => getQuote.mutate()}
                disabled={disabled || !canSubmitAddress}
              >
                {getQuote.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Quoting
                  </>
                ) : (
                  "Get courier quote"
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep("address")}
                disabled={disabled}
              >
                Back
              </Button>
              <Button onClick={pay} disabled={disabled || !quote}>
                {paying || verify.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Processing
                  </>
                ) : (
                  "Pay & book courier"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
