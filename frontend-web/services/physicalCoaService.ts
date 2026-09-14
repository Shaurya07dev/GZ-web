import type { PhysicalCoaRequest } from "@/types/artwork";
import { http } from "@/lib/api";

// The paper Certificate of Authenticity (MOU §12). A buyer who owns the piece
// can ask for one; the artist prints it, signs it, and dispatches it through
// the portal. Nothing here is automatic — a person physically signs paper,
// which is the whole point of the clause. Backed by /v1/coa/* and
// /v1/artist/coa/*; the certificate NUMBER itself is issued server-side when
// the artwork is approved, so a request on an unissued piece is refused.

/** Wire shape from apps/api coa.controller.ts. */
interface PhysicalCoaRequestDto {
  id: string;
  artworkId: string;
  artworkTitle: string;
  coaCertificateNumber: string | null;
  requestedByUserId: string;
  requestedByName: string;
  requestedAt: string | null;
  delivery: { line1: string; city: string; state: string; pincode: string };
  status: "requested" | "dispatched";
  dispatchedAt: string | null;
  courierRef: string | null;
}

function fromDto(dto: PhysicalCoaRequestDto): PhysicalCoaRequest {
  return {
    id: dto.id,
    artworkId: dto.artworkId,
    artworkTitle: dto.artworkTitle,
    coaCertificateNumber: dto.coaCertificateNumber ?? "",
    requestedByName: dto.requestedByName,
    requestedAt: dto.requestedAt ?? "",
    deliveryAddress: dto.delivery,
    status: dto.status,
    dispatchedAt: dto.dispatchedAt,
    courierRef: dto.courierRef,
  };
}

export const physicalCoaService = {
  listForArtwork: async (artworkId: string): Promise<PhysicalCoaRequest[]> => {
    const rows = await http.get<PhysicalCoaRequestDto[]>("/v1/coa/requests", {
      params: { artworkId },
    });
    return rows.map(fromDto);
  },

  // Every request across the signed-in artist's own artworks — what the
  // artist has to physically action.
  listForArtist: async (): Promise<PhysicalCoaRequest[]> => {
    const rows = await http.get<PhysicalCoaRequestDto[]>("/v1/artist/coa/requests");
    return rows.map(fromDto);
  },

  // `requestedByName` is still accepted for call-site compatibility but the
  // backend records the signed-in user, never a client-supplied name.
  request: async (input: {
    artworkId: string;
    requestedByName?: string;
    deliveryAddress: PhysicalCoaRequest["deliveryAddress"];
  }): Promise<PhysicalCoaRequest> => {
    const dto = await http.post<PhysicalCoaRequestDto>("/v1/coa/requests", {
      artworkId: input.artworkId,
      delivery: input.deliveryAddress,
    });
    return fromDto(dto);
  },

  markDispatched: async (input: {
    requestId: string;
    courierRef: string;
  }): Promise<PhysicalCoaRequest> => {
    if (!input.courierRef.trim()) {
      throw new Error("Enter the courier or tracking reference");
    }
    const dto = await http.post<PhysicalCoaRequestDto>(
      `/v1/artist/coa/requests/${encodeURIComponent(input.requestId)}/dispatch`,
      { courierRef: input.courierRef.trim() },
    );
    return fromDto(dto);
  },
};
