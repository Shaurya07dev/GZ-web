import QRCode from "qrcode";
import { verifyUrlFor } from "@/lib/verify-url";

// QR generation for an artwork's verification URL. Rendered client-side as a
// PNG data URL so the same image can be shown in the UI (<img>) and embedded
// in the certificate PDF (jsPDF addImage) without a second encoder.
// Error-correction level M survives a printed-and-photographed label.
export async function artworkQrDataUrl(artworkId: string, sizePx = 320): Promise<string> {
  return QRCode.toDataURL(verifyUrlFor(artworkId), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: sizePx,
    color: { dark: "#1a1612", light: "#ffffff" },
  });
}
