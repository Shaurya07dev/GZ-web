import {
  isDisplayActive,
  resolveCustody,
  transferKind,
  type Artwork,
  type OwnershipTransfer,
  type TransferKind,
} from "@/types/artwork";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  artworksCol,
  pendingArtworksCol,
  ownershipTransfersCol,
} from "@/lib/mock-collections";

// Digital ownership hand-over for an artwork's passport. The current owner
// names the next one and sends them a link; the record only changes when that
// person accepts. Resale runs the identical flow with the new owner as sender,
// which is what keeps provenance unbroken across every change of hands.

function findArtwork(artworkId: string): Artwork | undefined {
  return (
    artworksCol.get().find((a) => a.id === artworkId) ??
    pendingArtworksCol.get().find((a) => a.id === artworkId)
  );
}

function writeArtwork(updated: Artwork): void {
  const inLive = artworksCol.get().some((a) => a.id === updated.id);
  const replace = (list: Artwork[]) =>
    list.map((a) => (a.id === updated.id ? updated : a));
  if (inLive) artworksCol.set(replace(artworksCol.get()));
  else pendingArtworksCol.set(replace(pendingArtworksCol.get()));
}

export const ownershipService = {
  listForArtwork: (artworkId: string): Promise<OwnershipTransfer[]> =>
    mockDelay(
      ownershipTransfersCol
        .get()
        .filter((t) => t.artworkId === artworkId)
        .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt)),
    ),

  get: (transferId: string): Promise<OwnershipTransfer | undefined> =>
    mockDelay(ownershipTransfersCol.get().find((t) => t.id === transferId)),

  // Starts a hand-over. Only one can be open per artwork — two pending
  // transfers would mean two people could each claim the same piece.
  initiate: (input: {
    artworkId: string;
    fromName: string;
    toName: string;
    toEmail: string;
    kind?: TransferKind;
    /** Required for a display transfer: the date the display runs to. */
    displayEndsAt?: string | null;
  }): Promise<OwnershipTransfer> => {
    const artwork = findArtwork(input.artworkId);
    if (!artwork) return mockError("Artwork not found");
    if (!input.toName.trim()) return mockError("Enter the new owner's name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.toEmail.trim()))
      return mockError("Enter a valid email address");

    const kind: TransferKind = input.kind ?? "ownership";
    if (kind === "display") {
      if (!input.displayEndsAt)
        return mockError("Pick the date the display runs to");
      if (new Date(input.displayEndsAt).getTime() <= Date.now())
        return mockError("The display end date has to be in the future");
    }

    const alreadyOpen = ownershipTransfersCol
      .get()
      .some((t) => t.artworkId === input.artworkId && t.status === "pending");
    if (alreadyOpen)
      return mockError(
        "A transfer for this artwork is already waiting to be accepted",
      );

    // A piece cannot be lent twice over. The active loan has to end — by its
    // own date or by the owner ending it — before another one starts.
    const onDisplay = ownershipTransfersCol
      .get()
      .some((t) => t.artworkId === input.artworkId && isDisplayActive(t));
    if (onDisplay)
      return mockError(
        "This artwork is already on display somewhere. End that display first.",
      );

    const transfer: OwnershipTransfer = {
      id: `tr-${crypto.randomUUID().slice(0, 8)}`,
      artworkId: artwork.id,
      artworkTitle: artwork.title,
      fromName: input.fromName,
      toName: input.toName.trim(),
      toEmail: input.toEmail.trim(),
      initiatedAt: new Date().toISOString(),
      acceptedAt: null,
      cancelledAt: null,
      status: "pending",
      kind,
      displayEndsAt: kind === "display" ? input.displayEndsAt : null,
      displayEndedAt: null,
    };
    ownershipTransfersCol.set([transfer, ...ownershipTransfersCol.get()]);
    return mockDelay(transfer);
  },

  // The buyer accepting is what actually moves ownership — nothing changes on
  // the artwork until this runs. A display transfer accepted here moves
  // nothing at all: custody on display is derived from the record and the
  // date, so there is no state to write and none to unwind at expiry.
  accept: (transferId: string): Promise<OwnershipTransfer> => {
    const transfer = ownershipTransfersCol
      .get()
      .find((t) => t.id === transferId);
    if (!transfer) return mockError("This transfer link is not valid");
    if (transfer.status === "accepted")
      return mockError("This transfer has already been accepted");
    if (transfer.status === "cancelled")
      return mockError("This transfer was cancelled by the sender");

    const artwork = findArtwork(transfer.artworkId);
    if (!artwork) return mockError("Artwork not found");

    const now = new Date().toISOString();
    const accepted: OwnershipTransfer = {
      ...transfer,
      status: "accepted",
      acceptedAt: now,
    };
    ownershipTransfersCol.set(
      ownershipTransfersCol
        .get()
        .map((t) => (t.id === transferId ? accepted : t)),
    );

    if (transferKind(transfer) === "ownership") {
      const current = resolveCustody(artwork);
      writeArtwork({
        ...artwork,
        custody: {
          ...current,
          legalOwner: "customer",
          legalOwnerName: transfer.toName,
          custodian:
            current.custodian === "artist" ? "customer" : current.custodian,
          locationLabel: `With ${transfer.toName}`,
        },
      });
    }

    return mockDelay(accepted);
  },

  // The owner pulling a piece back before the end date. The alternative — the
  // date passing — needs no call at all.
  endDisplay: (transferId: string): Promise<OwnershipTransfer> => {
    const transfer = ownershipTransfersCol
      .get()
      .find((t) => t.id === transferId);
    if (!transfer) return mockError("Display record not found");
    if (!isDisplayActive(transfer))
      return mockError("This display has already ended");

    const ended: OwnershipTransfer = {
      ...transfer,
      displayEndedAt: new Date().toISOString(),
    };
    ownershipTransfersCol.set(
      ownershipTransfersCol.get().map((t) => (t.id === transferId ? ended : t)),
    );
    return mockDelay(ended);
  },

  cancel: (transferId: string): Promise<OwnershipTransfer> => {
    const transfer = ownershipTransfersCol
      .get()
      .find((t) => t.id === transferId);
    if (!transfer) return mockError("Transfer not found");
    if (transfer.status !== "pending")
      return mockError("Only a pending transfer can be cancelled");

    const cancelled: OwnershipTransfer = {
      ...transfer,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    ownershipTransfersCol.set(
      ownershipTransfersCol
        .get()
        .map((t) => (t.id === transferId ? cancelled : t)),
    );
    return mockDelay(cancelled);
  },
};
