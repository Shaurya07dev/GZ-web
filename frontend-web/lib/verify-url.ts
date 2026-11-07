// The public address an artwork's QR code and NFC tag lead to. It is printed on
// certificates and display cards and locked onto chips, so it has to outlive any
// one deployment: it is always the public site, never wherever this build
// happens to run (a laptop, a preview deployment). The mobile app builds the
// same link from the same origin (mobile/lib/core/config.dart).
// NEXT_PUBLIC_SITE_URL lets a staging build name its own public host;
// next.config.ts refuses a production build where it is not a public https
// address. Kept dependency-free so both server and client code can import it.

export const PUBLIC_SITE_URL = "https://www.galleryzone.in";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || PUBLIC_SITE_URL).replace(/\/+$/, "");

export function verifyUrlFor(artworkId: string): string {
  return `${SITE_URL}/verify/${encodeURIComponent(artworkId)}`;
}
