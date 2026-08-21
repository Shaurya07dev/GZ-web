"use client";

import { useState } from "react";
import { Printer, PackageCheck, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useArtistCoaRequests,
  useMarkCoaDispatchedMutation,
} from "@/hooks/usePhysicalCoa";

// MOU §12: a buyer can ask for the certificate on paper after a sale. The
// artist prints it, signs it by hand, and posts it — this is the queue of
// those requests and the place they record the dispatch.
export function PhysicalCoaQueue() {
  const { data: requests } = useArtistCoaRequests();
  const open = (requests ?? []).filter((r) => r.status === "requested");
  const done = (requests ?? []).filter((r) => r.status === "dispatched");

  if ((requests ?? []).length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">
          Physical certificate requests
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Buyers who want the Certificate of Authenticity on paper. Print it,
          sign it by hand, and post it to the address shown.
        </p>
      </div>

      {open.map((request) => (
        <OpenRequest key={request.id} request={request} />
      ))}

      {done.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Dispatched
          </p>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {done.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0"
              >
                <span className="text-foreground">{request.artworkTitle}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {request.courierRef}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OpenRequest({
  request,
}: {
  request: NonNullable<ReturnType<typeof useArtistCoaRequests>["data"]>[number];
}) {
  const dispatchMutation = useMarkCoaDispatchedMutation();
  const [courierRef, setCourierRef] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-start gap-3">
        <Printer
          className="mt-0.5 size-4 shrink-0 text-gold-bright"
          strokeWidth={1.75}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {request.artworkTitle}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {request.coaCertificateNumber}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background/60 px-3.5 py-3 text-sm">
        <p className="text-xs text-muted-foreground">Post to</p>
        <p className="mt-0.5 text-foreground">{request.requestedByName}</p>
        <p className="text-muted-foreground">
          {request.deliveryAddress.line1}, {request.deliveryAddress.city},{" "}
          {request.deliveryAddress.state} {request.deliveryAddress.pincode}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`courier-${request.id}`}>Courier / tracking ref</Label>
          <Input
            id={`courier-${request.id}`}
            value={courierRef}
            onChange={(e) => setCourierRef(e.target.value)}
            placeholder="e.g. BLUEDART 4829174"
            className="h-10"
          />
        </div>
        <button
          type="button"
          disabled={!courierRef.trim() || dispatchMutation.isPending}
          onClick={() =>
            dispatchMutation.mutate({ requestId: request.id, courierRef })
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gold/60 px-4 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-40"
        >
          <PackageCheck className="size-3.5" />
          Printed, signed &amp; dispatched
        </button>
      </div>

      {dispatchMutation.isError && (
        <p className="text-sm text-destructive">
          {dispatchMutation.error instanceof Error
            ? dispatchMutation.error.message
            : "Something went wrong."}
        </p>
      )}
      {dispatchMutation.isSuccess && (
        <p className="flex items-center gap-1.5 text-sm text-gold-bright">
          <Check className="size-3.5" />
          Recorded.
        </p>
      )}
    </div>
  );
}
