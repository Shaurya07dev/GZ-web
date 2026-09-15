"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { Printer, Clock3, PackageCheck } from "lucide-react";
import {
  useArtworkCoaRequests,
  useRequestPhysicalCoaMutation,
} from "@/hooks/usePhysicalCoa";
import { useAddresses } from "@/hooks/useAddresses";
import { mockCustomer } from "@/lib/mock-data/customer";

// The buyer's side of MOU §12. The digital certificate always exists; this
// asks the artist for the signed paper original, posted to the collector's
// default address.
export function PhysicalCoaRequest({
  artworkId,
  artworkTitle,
}: {
  artworkId: string;
  artworkTitle: string;
}) {
  const { data: me } = useCurrentUser();
  const { data: requests } = useArtworkCoaRequests(artworkId);
  const { data: addresses } = useAddresses();
  const requestMutation = useRequestPhysicalCoaMutation();

  const existing = (requests ?? [])[0];
  const address = (addresses ?? []).find((a) => a.isDefault) ?? (addresses ?? [])[0];

  if (existing?.status === "dispatched") {
    return (
      <Status
        icon={PackageCheck}
        title="Signed certificate posted"
        detail={
          existing.courierRef
            ? `Tracking ${existing.courierRef}`
            : "On its way to you"
        }
      />
    );
  }

  if (existing?.status === "requested") {
    return (
      <Status
        icon={Clock3}
        title="Physical certificate requested"
        detail="The artist prints, signs and posts it — you'll see tracking here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <button
        type="button"
        disabled={!address || requestMutation.isPending}
        onClick={() =>
          address &&
          requestMutation.mutate({
            artworkId,
            requestedByName: me?.name ?? "",
            deliveryAddress: {
              line1: address.line1,
              city: address.city,
              state: address.state,
              pincode: address.pincode,
            },
          })
        }
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        <Printer className="size-3.5" />
        Request signed paper certificate
      </button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {address
          ? `The artist signs the certificate for “${artworkTitle}” by hand and posts it to ${address.city}.`
          : "Add a delivery address to your account first."}
      </p>
      {requestMutation.isError && (
        <p className="text-xs text-destructive">
          {requestMutation.error instanceof Error
            ? requestMutation.error.message
            : "Something went wrong."}
        </p>
      )}
    </div>
  );
}

function Status({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Printer;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 border-t border-border pt-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-gold-bright" strokeWidth={1.75} />
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
