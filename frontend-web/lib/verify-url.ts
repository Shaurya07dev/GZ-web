// The public verification URL an artwork's QR code (and NFC tag) resolves
// to. Built from NEXT_PUBLIC_SITE_URL, never window.location: a QR printed
// on a physical certificate from a dev machine must still point at the real
// domain. Kept dependency-free so both server and client code can import it.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function verifyUrlFor(artworkId: string): string {
  return `${SITE_URL}/verify/${encodeURIComponent(artworkId)}`;
}
