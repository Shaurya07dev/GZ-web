import { http, isApiError, API_URL } from "@/lib/api";
import type { OwnershipTransfer, TransferKind, TransferStatus } from "@/types/artwork";
import { artworksCol, ownershipTransfersCol } from "@/lib/mock-collections";

// The public artwork passport (GET /v1/verify/:artworkId) — what a printed
// QR / NFC tag resolves to. No auth; carries name snapshots only, never a
// price or a contact detail (the backend's verify-dto.check.ts enforces
// that), so it is safe to render for anyone who scans.

export interface VerifyPassport {
  artworkId: string;
  productCode: string;
  title: string;
  artistId: string;
  artistName: string;
  category: string;
  medium: string;
  dimensions: string | null;
  yearCreated: number | null;
  images: { url: string; thumbnailUrl: string | null; altText: string | null; sortOrder: number }[];
  status: string;
  coaCertificateNumber: string | null;
  coaIssuedAt: string | null;
  listedAt: string;
  owner: { kind: "artist" | "collector"; displayName: string };
  events: PassportEvent[];
}

export interface PassportEvent {
  id: string;
  kind: TransferKind;
  status: TransferStatus;
  fromName: string;
  toName: string;
  viaSale: boolean;
  initiatedAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  displayEndsAt: string | null;
  displayEndedAt: string | null;
}

/** Passport events -> the OwnershipTransfer shape the existing history UI renders. */
export function passportEventToTransfer(
  e: PassportEvent,
  passport: Pick<VerifyPassport, "artworkId" | "title">,
): OwnershipTransfer {
  return {
    id: e.id,
    artworkId: passport.artworkId,
    artworkTitle: passport.title,
    fromName: e.fromName,
    toName: e.toName,
    // Public view: the invite address is never exposed.
    toEmail: "",
    initiatedAt: e.initiatedAt,
    acceptedAt: e.acceptedAt,
    cancelledAt: e.cancelledAt,
    status: e.status,
    kind: e.kind,
    displayEndsAt: e.displayEndsAt,
    displayEndedAt: e.displayEndedAt,
  };
}

export const verifyService = {
  get: async (artworkId: string): Promise<VerifyPassport | undefined> => {
    // ---- DEMO MOCK ----
    if (artworkId === "aw-5" || artworkId === "aw-1") {
      const art = artworksCol.get().find((a) => a.id === artworkId);
      if (art) {
        const transfers = ownershipTransfersCol.get().filter((t) => t.artworkId === artworkId);
        return {
          artworkId: art.id,
          productCode: "GZ-" + art.id.toUpperCase(),
          title: art.title,
          artistId: art.artistId,
          artistName: art.artistName,
          category: art.category,
          medium: art.medium,
          dimensions: art.dimensions,
          yearCreated: art.yearCreated,
          images: art.images,
          status: art.status,
          coaCertificateNumber: art.coaCertificateNumber,
          coaIssuedAt: art.coaIssueDate,
          listedAt: art.statusHistory[0]?.changedAt || new Date().toISOString(),
          owner: { kind: "collector", displayName: transfers[transfers.length - 1]?.toName || "Arun Mehra" },
          events: transfers.map(t => ({
            id: t.id,
            kind: t.kind || "ownership",
            status: t.status,
            fromName: t.fromName,
            toName: t.toName,
            viaSale: true,
            initiatedAt: t.initiatedAt,
            acceptedAt: t.acceptedAt,
            cancelledAt: t.cancelledAt,
            displayEndsAt: t.displayEndsAt || null,
            displayEndedAt: t.displayEndedAt || null,
          })),
        };
      }
    }
    // -------------------
    try {
      return await http.get<VerifyPassport>(`/v1/verify/${encodeURIComponent(artworkId)}`);
    } catch (error) {
      if (isApiError(error, 404)) return undefined;
      throw error;
    }
  },

  /** Server-side variant for generateMetadata — plain fetch, no auth, never throws. */
  getForMetadata: async (artworkId: string): Promise<VerifyPassport | null> => {
    try {
      const res = await fetch(`${API_URL}/v1/verify/${encodeURIComponent(artworkId)}`, { next: { revalidate: 60 } });
      return res.ok ? ((await res.json()) as VerifyPassport) : null;
    } catch {
      return null;
    }
  },
};
