// The public artwork passport — what GET /v1/verify/:artworkId (the QR /
// NFC target) returns to ANYONE. plan.md §12: title, artist, product id,
// ownership status, certificate. Never a price of any kind, never an
// email, phone or address, never a user id of a collector.
// verify-dto.check.ts enforces the forbidden-field list on this interface.

export interface VerifyPassportDto {
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
  events: {
    id: string;
    kind: "ownership" | "display";
    status: "pending" | "accepted" | "cancelled";
    fromName: string;
    toName: string;
    /** True when the transfer was a marketplace sale rather than a manual hand-over. */
    viaSale: boolean;
    initiatedAt: string;
    acceptedAt: string | null;
    cancelledAt: string | null;
    displayEndsAt: string | null;
    displayEndedAt: string | null;
  }[];
}
