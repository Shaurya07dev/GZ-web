import type { Artwork, PhysicalCoaRequest } from "@/types/artwork";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  artworksCol,
  pendingArtworksCol,
  physicalCoaRequestsCol,
  CURRENT_ARTIST_ID,
} from "@/lib/mock-collections";

// The paper Certificate of Authenticity (MOU §12). A buyer who owns the piece
// can ask for one; the artist prints it, signs it, and dispatches it through
// the portal. Nothing here is automatic — a person physically signs paper,
// which is the whole point of the clause.

function findArtwork(artworkId: string): Artwork | undefined {
  return (
    artworksCol.get().find((a) => a.id === artworkId) ??
    pendingArtworksCol.get().find((a) => a.id === artworkId)
  );
}

export const physicalCoaService = {
  listForArtwork: (artworkId: string): Promise<PhysicalCoaRequest[]> =>
    mockDelay(
      physicalCoaRequestsCol.get().filter((r) => r.artworkId === artworkId),
    ),

  // Every open request across the artist's own artworks — what the artist has
  // to physically action.
  listForArtist: (): Promise<PhysicalCoaRequest[]> => {
    const own = new Set(
      [...artworksCol.get(), ...pendingArtworksCol.get()]
        .filter((a) => a.artistId === CURRENT_ARTIST_ID)
        .map((a) => a.id),
    );
    return mockDelay(
      physicalCoaRequestsCol
        .get()
        .filter((r) => own.has(r.artworkId))
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    );
  },

  request: (input: {
    artworkId: string;
    requestedByName: string;
    deliveryAddress: PhysicalCoaRequest["deliveryAddress"];
  }): Promise<PhysicalCoaRequest> => {
    const artwork = findArtwork(input.artworkId);
    if (!artwork) return mockError("Artwork not found");

    const open = physicalCoaRequestsCol
      .get()
      .some((r) => r.artworkId === input.artworkId && r.status === "requested");
    if (open)
      return mockError(
        "A physical certificate for this artwork has already been requested",
      );

    const record: PhysicalCoaRequest = {
      id: `coa-${crypto.randomUUID().slice(0, 8)}`,
      artworkId: artwork.id,
      artworkTitle: artwork.title,
      coaCertificateNumber: artwork.coaCertificateNumber,
      requestedByName: input.requestedByName,
      requestedAt: new Date().toISOString(),
      deliveryAddress: input.deliveryAddress,
      status: "requested",
      dispatchedAt: null,
      courierRef: null,
    };
    physicalCoaRequestsCol.set([record, ...physicalCoaRequestsCol.get()]);
    return mockDelay(record);
  },

  markDispatched: (input: {
    requestId: string;
    courierRef: string;
  }): Promise<PhysicalCoaRequest> => {
    const record = physicalCoaRequestsCol
      .get()
      .find((r) => r.id === input.requestId);
    if (!record) return mockError("Request not found");
    if (record.status === "dispatched")
      return mockError("This certificate has already been dispatched");
    if (!input.courierRef.trim())
      return mockError("Enter the courier or tracking reference");

    const dispatched: PhysicalCoaRequest = {
      ...record,
      status: "dispatched",
      dispatchedAt: new Date().toISOString(),
      courierRef: input.courierRef.trim(),
    };
    physicalCoaRequestsCol.set(
      physicalCoaRequestsCol
        .get()
        .map((r) => (r.id === dispatched.id ? dispatched : r)),
    );
    return mockDelay(dispatched);
  },
};
