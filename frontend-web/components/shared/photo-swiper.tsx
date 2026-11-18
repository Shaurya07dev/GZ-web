"use client";

import { useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/api-mappers";
import { ArtworkImagePlaceholder } from "@/components/shared/artwork-image-placeholder";

export interface SwiperPhoto {
  url: string;
  thumbnailUrl?: string | null;
}

/** An artwork's photos in the artist's order (cover first), in the shape the swiper takes. */
export function sortedPhotos(
  images: { url: string; thumbnailUrl?: string | null; sortOrder: number }[] | undefined,
): SwiperPhoto[] {
  return [...(images ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({ url: image.url, thumbnailUrl: image.thumbnailUrl }));
}

interface PhotoSwiperProps {
  photos: SwiperPhoto[];
  /** The artwork's title; each photo is announced as "title, photo 2 of 3". */
  alt: string;
  /** The photo shown when there is only the cover (or nothing else is known). */
  fallbackSrc: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  /** Smaller arrows and no dots, for a thumbnail. */
  compact?: boolean;
}

/**
 * Every photo of a piece in one place you can swipe through: a row of full-width slides that snaps (native touch
 * scrolling, so it feels right on a phone), with arrows on hover for a mouse and dots for where you are. It sits
 * inside cards that are links, so a swipe scrolls and a tap still opens the piece; the arrows never follow the link.
 * With one photo it is just the photo.
 */
export function PhotoSwiper({ photos, alt, fallbackSrc, sizes, className, imageClassName, compact = false }: PhotoSwiperProps) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = photos.length > 0 ? photos : [{ url: fallbackSrc, thumbnailUrl: fallbackSrc }];
  const count = slides.length;

  if (count === 1 && isPlaceholderImage(slides[0]!.thumbnailUrl ?? slides[0]!.url)) {
    return <ArtworkImagePlaceholder />;
  }

  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };

  const go = (event: MouseEvent, to: number) => {
    event.preventDefault();
    event.stopPropagation();
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: Math.min(count - 1, Math.max(0, to)) * el.clientWidth, behavior: "smooth" });
  };

  const arrow = "absolute top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition-opacity hover:bg-background group-hover/swiper:flex";

  return (
    <div className={cn("group/swiper relative size-full overflow-hidden", className)}>
      <div
        ref={track}
        onScroll={onScroll}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((photo, i) => (
          <div key={`${photo.url}-${i}`} className="relative size-full shrink-0 snap-center">
            <Image
              src={photo.thumbnailUrl ?? photo.url}
              alt={count > 1 ? `${alt}, photo ${i + 1} of ${count}` : alt}
              fill
              sizes={sizes}
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
              className={cn("object-cover", imageClassName)}
            />
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => go(e, index - 1)}
              className={cn(arrow, "left-1.5", compact ? "size-6" : "size-8")}
            >
              <ChevronLeft className={compact ? "size-3.5" : "size-4"} />
            </button>
          )}
          {index < count - 1 && (
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => go(e, index + 1)}
              className={cn(arrow, "right-1.5", compact ? "size-6" : "size-8")}
            >
              <ChevronRight className={compact ? "size-3.5" : "size-4"} />
            </button>
          )}
          {!compact && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5"
              role="presentation"
              data-testid="photo-dots"
            >
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full bg-white/90 shadow-[0_0_3px_rgba(0,0,0,0.5)] transition-all duration-200",
                    i === index ? "w-4" : "w-1.5 opacity-60",
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
