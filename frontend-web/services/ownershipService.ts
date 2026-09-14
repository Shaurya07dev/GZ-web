import type { OwnershipTransfer, TransferKind } from "@/types/artwork";
import { http, isApiError } from "@/lib/api";
import { passportEventToTransfer, verifyService } from "./verifyService";

// Legal ownership hand-overs, on the API. The chain is an event log on the
// backend (artworks/{id}/ownershipEvents); a marketplace sale writes an
// already-accepted event when the order is paid, and this service covers
// the MANUAL hand-over: the current owner invites someone by email, that
// person accepts from /transfer/{id}. Resale runs the identical flow with
// the new owner as sender. `display` lends the piece for a period without
// moving title.

/** Party view from /v1/transfers/*: public fields + invite email + title. */
interface TransferDto {
  id: string;
  artworkId: string;
  artworkTitle: string;
  kind: TransferKind;
  status: OwnershipTransfer["status"];
  fromName: string;
  toName: string;
  toEmail: string | null;
  viaSale: boolean;
  initiatedAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  displayEndsAt: string | null;
  displayEndedAt: string | null;
}

function fromDto(dto: TransferDto): OwnershipTransfer {
  return {
    id: dto.id,
    artworkId: dto.artworkId,
    artworkTitle: dto.artworkTitle,
    fromName: dto.fromName,
    toName: dto.toName,
    toEmail: dto.toEmail ?? "",
    initiatedAt: dto.initiatedAt,
    acceptedAt: dto.acceptedAt,
    cancelledAt: dto.cancelledAt,
    status: dto.status,
    kind: dto.kind,
    displayEndsAt: dto.displayEndsAt,
    displayEndedAt: dto.displayEndedAt,
  };
}

export const ownershipService = {
  // The public passport already carries the full chain (names only), so the
  // history needs no auth — a scanned QR shows it to anyone.
  listForArtwork: async (artworkId: string): Promise<OwnershipTransfer[]> => {
    const passport = await verifyService.get(artworkId);
    if (!passport) return [];
    return passport.events
      .map((e) => passportEventToTransfer(e, passport))
      .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
  },

  get: async (transferId: string): Promise<OwnershipTransfer | undefined> => {
    try {
      return fromDto(await http.get<TransferDto>(`/v1/transfers/${encodeURIComponent(transferId)}`));
    } catch (error) {
      if (isApiError(error, 404)) return undefined;
      throw error;
    }
  },

  // Starts a hand-over. The backend enforces "current owner only" and "one
  // open transfer per artwork". `fromName` is accepted for call-site
  // compatibility; the sender is the signed-in account.
  initiate: async (input: {
    artworkId: string;
    fromName?: string;
    toName: string;
    toEmail: string;
    kind?: TransferKind;
    displayEndsAt?: string | null;
  }): Promise<OwnershipTransfer> => {
    const kind: TransferKind = input.kind ?? "ownership";
    if (kind === "display" && !input.displayEndsAt) {
      throw new Error("Pick the date the display runs to");
    }
    const dto = await http.post<TransferDto>(
      `/v1/artworks/${encodeURIComponent(input.artworkId)}/transfers`,
      {
        kind,
        toName: input.toName.trim(),
        toEmail: input.toEmail.trim(),
        ...(kind === "display" && input.displayEndsAt
          ? { displayEndsAt: new Date(input.displayEndsAt).toISOString() }
          : {}),
      },
    );
    return fromDto(dto);
  },

  // The recipient accepting is what actually moves ownership.
  accept: async (transferId: string): Promise<OwnershipTransfer> =>
    fromDto(await http.post<TransferDto>(`/v1/transfers/${encodeURIComponent(transferId)}/accept`)),

  endDisplay: async (transferId: string): Promise<OwnershipTransfer> =>
    fromDto(await http.post<TransferDto>(`/v1/transfers/${encodeURIComponent(transferId)}/end-display`)),

  cancel: async (transferId: string): Promise<OwnershipTransfer> =>
    fromDto(await http.post<TransferDto>(`/v1/transfers/${encodeURIComponent(transferId)}/cancel`)),
};
