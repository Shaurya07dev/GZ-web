"use client";

import { useEffect, useState } from "react";
import { artworkQrDataUrl } from "@/lib/qr";
import { verifyUrlFor } from "@/lib/verify-url";
import { cn } from "@/lib/utils";

// The QR that goes on the physical label / certificate. It encodes the
// public verification URL (lib/verify-url.ts), so scanning it with any
// phone opens the passport — no app, no NFC entitlement.
export function ArtworkQr({
  artworkId,
  size = 128,
  showUrl = false,
  className,
}: {
  artworkId: string;
  size?: number;
  showUrl?: boolean;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    artworkQrDataUrl(artworkId, size * 2)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [artworkId, size]);

  const url = verifyUrlFor(artworkId);

  return (
    <figure className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className="overflow-hidden rounded-md border border-gold/30 bg-white p-1.5"
        style={{ width: size + 12, height: size + 12 }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimisable asset
          <img
            src={src}
            alt={`QR code linking to ${url}`}
            width={size}
            height={size}
          />
        ) : (
          <div className="size-full animate-pulse bg-muted" aria-hidden="true" />
        )}
      </div>
      {showUrl && (
        <figcaption className="max-w-[16rem] truncate font-mono text-[10px] text-muted-foreground">
          {url}
        </figcaption>
      )}
    </figure>
  );
}
