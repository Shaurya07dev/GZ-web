"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/api";
import { currentIdToken } from "@/lib/firebase";

interface DownloadInvoiceButtonProps {
  orderId: string;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Downloads /v1/orders/{id}/invoice.pdf with the Firebase ID token attached.
 * Reads Content-Disposition for the filename so the saved file matches the
 * backend-stamped invoice number instead of a generic "download.pdf".
 */
export function DownloadInvoiceButton({
  orderId,
  disabled,
  disabledReason,
}: DownloadInvoiceButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const token = await currentIdToken();
      const res = await fetch(
        `${API_URL}/v1/orders/${encodeURIComponent(orderId)}/invoice.pdf`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { title?: string }
          | null;
        throw new Error(body?.title ?? `Download failed (${res.status})`);
      }
      const filename =
        parseFilename(res.headers.get("Content-Disposition")) ??
        `invoice-${orderId}.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      title={disabled ? disabledReason : undefined}
      className="inline-flex items-center gap-2 rounded-md border border-gold/60 px-3 py-1.5 text-xs font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Download className="size-3.5" strokeWidth={2} />
      )}
      Download invoice
    </button>
  );
}

function parseFilename(header: string | null): string | null {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
