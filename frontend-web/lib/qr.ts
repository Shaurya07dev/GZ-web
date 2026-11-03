import QRCode from "qrcode";
import { verifyUrlFor } from "@/lib/verify-url";

// QR generation. Rendered client-side as a PNG data URL so the same image can
// be shown in the UI (<img>) and embedded in the certificate PDF (jsPDF
// addImage) without a second encoder.
//
// Error correction is the share of the code that can be lost and still scan:
//   M (15%)  on screen.
//   Q (25%)  on paper: a certificate is kept for decades, through creases, stains and fading.
//   H (30%)  when something is printed over the middle, like the GZ seal on the display card.
export type QrLevel = "M" | "Q" | "H";

export async function qrDataUrl(value: string, sizePx = 320, level: QrLevel = "M"): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: level,
    margin: 1,
    width: sizePx,
    color: { dark: "#1a1612", light: "#ffffff" },
  });
}

/** The QR on an artwork's certificate and label: its public verification URL, the same one written to its NFC tag. */
export async function artworkQrDataUrl(artworkId: string, sizePx = 320, level: QrLevel = "M"): Promise<string> {
  return qrDataUrl(verifyUrlFor(artworkId), sizePx, level);
}
