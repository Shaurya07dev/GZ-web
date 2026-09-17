import { http } from "@/lib/api";

// NFC tag linking service — bridges a physical NTAG 424 DNA chip to a
// specific artwork record. In production the "link" call would:
//   1. POST the tag UID + CMAC to the backend (which calls GCP KMS to verify
//      the SUN signature and confirm the chip is genuine).
//   2. The backend records nfc_tags.artwork_id and writes an ownership_event.
// For the dashboard "simulate" flow we generate a client-side tag ID and hit
// the same patch endpoint the artwork submit form uses (nfcTagId field on the
// artwork write payload). The real implementation should live behind
// /v1/artist/artworks/:id/nfc-tag when the NFC provisioning flow lands.

export interface LinkNfcTagResult {
  artworkId: string;
  nfcTagId: string;
  linkedAt: string;
}

/**
 * Generates a locally-unique NFC tag ID (mirrors the format the backend will
 * assign during real NTAG 424 provisioning: `NFC-` + 8 random hex chars).
 */
export function generateNfcTagId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `NFC-${hex}`;
}

/**
 * Links a physical NFC tag to an artwork by PATCH-ing the artwork's nfcTagId
 * field. Idempotent: calling again with a different tagId replaces it.
 */
export const nfcTagService = {
  linkTag: async (
    artworkId: string,
    nfcTagId: string,
  ): Promise<LinkNfcTagResult> => {
    // The artwork patch endpoint accepts `nfcTagId` as part of the standard
    // artwork write payload — same field the submit form populates.
    await http.patch(`/v1/artist/artworks/${encodeURIComponent(artworkId)}`, {
      nfcTagId,
    });
    return {
      artworkId,
      nfcTagId,
      linkedAt: new Date().toISOString(),
    };
  },
};
