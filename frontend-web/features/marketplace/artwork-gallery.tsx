"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/api-mappers";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ArtworkImagePlaceholder } from "@/components/shared/artwork-image-placeholder";
import type { ArtworkImage } from "@/types/artwork";

interface ArtworkGalleryProps {
  images: ArtworkImage[];
  title: string;
}

// Hero + thumbnail-strip gallery with click-to-expand zoom (Dialog), per
// Task 15 Step 1 — a full-bleed lightbox rather than hover-zoom, since the
// certificate-grade images here reward a proper look rather than a cursor
// trick that only works on desktop.
export function ArtworkGallery({ images, title }: ArtworkGalleryProps) {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const active = sorted[activeIndex] ?? sorted[0];
  const touchStart = useRef<number | null>(null);

  if (!active) return null;

  // Swipe the big photo (or use the arrows): every angle is one gesture away, not a tap on a small thumbnail.
  const go = (step: number) => setActiveIndex((i) => (i + step + sorted.length) % sorted.length);

  const isPlaceholder = isPlaceholderImage(active.url);

  return (
    <div className="flex flex-col gap-3">
      <Dialog open={zoomOpen} onOpenChange={isPlaceholder ? undefined : setZoomOpen}>
        <div
          className="relative"
          onTouchStart={(e) => {
            touchStart.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (start === null || sorted.length < 2) return;
            const dx = (e.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
        <button
          type="button"
          disabled={isPlaceholder}
          onClick={() => setZoomOpen(true)}
          className="group relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
        >
          {isPlaceholder ? (
            <ArtworkImagePlaceholder />
          ) : (
            <>
              <Image
                src={active.url}
                alt={active.altText}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
                <Expand className="size-3.5" strokeWidth={1.75} />
                View full size
              </span>
            </>
          )}
        </button>
          {sorted.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => go(-1)}
                className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => go(1)}
                className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground tabular-nums backdrop-blur-sm">
                {activeIndex + 1} / {sorted.length}
              </span>
            </>
          )}
        </div>

        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">
            Full size view of {title}
          </DialogTitle>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black/40">
            <Image
              src={active.url}
              alt={active.altText}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

      {sorted.length > 1 && (
        <div
          className="flex gap-2.5 overflow-x-auto pb-1"
          role="list"
          aria-label="Artwork images"
        >
          {sorted.map((image, index) => (
            <button
              key={`${image.url}-${image.sortOrder}`}
              type="button"
              role="listitem"
              onClick={() => setActiveIndex(index)}
              aria-current={index === activeIndex}
              aria-label={`View ${image.altText}`}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-md border transition-colors sm:size-[72px]",
                index === activeIndex
                  ? "border-gold-bright ring-1 ring-gold-bright"
                  : "border-border hover:border-gold/50",
              )}
            >
              <Image
                src={image.thumbnailUrl}
                alt=""
                fill
                sizes="72px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
