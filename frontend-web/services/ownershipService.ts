import {
  resolveCustody,
  type Artwork,
  type OwnershipTransfer,
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
  }): Promise<OwnershipTransfer> => {
    const artwork = findArtwork(input.artworkId);
    if (!artwork) return mockError("Artwork not found");
    if (!input.toName.trim()) return mockError("Enter the new owner's name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.toEmail.trim()))
      return mockError("Enter a valid email address");

    const alreadyOpen = ownershipTransfersCol
      .get()
      .some((t) => t.artworkId === input.artworkId && t.status === "pending");
    if (alreadyOpen)
      return mockError(
        "A transfer for this artwork is already waiting to be accepted",
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
    };
    ownershipTransfersCol.set([transfer, ...ownershipTransfersCol.get()]);
    return mockDelay(transfer);
  },

  // The buyer accepting is what actually moves ownership — nothing changes on
  // the artwork until this runs.
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

    const current = resolveCustody(artwork);
    writeArtwork({
      ...artwork,
      custody: {
        ...current,
        legalOwner: "customer",
        legalOwnerName: transfer.toName,
        custodian: current.custodian === "artist" ? "customer" : current.custodian,
        locationLabel: `With ${transfer.toName}`,
      },
    });

    return mockDelay(accepted);
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
