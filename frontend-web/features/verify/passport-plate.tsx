"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ArtworkImagePlaceholder } from "@/components/shared/artwork-image-placeholder";
import { isPlaceholderImage } from "@/lib/api-mappers";
import { cn } from "@/lib/utils";
import type { ArtworkImage } from "@/types/artwork";

// The artwork, shown the way a museum shows an object: as large as the screen allows, never cropped, on a mat
// board a step off the page colour. A painting is judged by its edges and its proportions, so the image is
// `contain`ed inside a fixed-height mat (no layout shift whatever the picture's shape), and tapping it opens the
// whole thing full size. Extra photographs (detail, signature, reverse) sit under it as a quiet strip.
//
// Shape rule for the passport: art and documents have square edges, controls are pills.

export function PassportPlate({ images, title }: { images: ArtworkImage[]; title: string }) {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const active = sorted[index] ?? sorted[0];
  const placeholder = !active || isPlaceholderImage(active.url);
  const alt = active?.altText || title;

  return (
    <figure className="flex flex-col gap-3">
      <Dialog open={open} onOpenChange={placeholder ? undefined : setOpen}>
        <button
          type="button"
          disabled={placeholder}
          onClick={() => setOpen(true)}
          aria-label={`View ${title} full size`}
          className="pp-plate relative block h-[min(52dvh,26rem)] w-full cursor-zoom-in sm:h-[min(62dvh,34rem)] overflow-hidden rounded-[2px] bg-passport-mat ring-1 ring-passport-rule focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-default lg:h-[min(72dvh,52rem)]"
        >
          {placeholder || !active ? (
            <ArtworkImagePlaceholder />
          ) : (
            <Image
              key={active.url}
              src={active.url}
              alt={alt}
              fill
              priority
              sizes="(min-width: 1024px) 56vw, 100vw"
              className="pp-fade object-contain p-5 sm:p-10"
            />
          )}
        </button>

        <DialogContent className="h-[90dvh] max-w-[min(96vw,1200px)] rounded-[2px] border-none bg-background p-0 ring-0 sm:max-w-[min(96vw,1200px)]">
          <DialogTitle className="sr-only">Full size view of {title}</DialogTitle>
          {active && !placeholder && (
            <div className="relative size-full">
              <Image src={active.url} alt={alt} fill sizes="96vw" className="object-contain p-4 sm:p-8" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {(sorted.length > 1 || !placeholder) && (
        <figcaption className="flex min-h-12 items-center justify-between gap-6">
          {sorted.length > 1 && (
            <ul className="flex gap-2" aria-label="More views">
              {sorted.map((image, i) => (
                <li key={`${image.url}-${image.sortOrder}`}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show view ${i + 1} of ${sorted.length}`}
                    aria-current={i === index}
                    className={cn(
                      "relative block size-12 overflow-hidden rounded-[2px] bg-passport-mat transition-[opacity,box-shadow] duration-150 ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      i === index ? "opacity-100 ring-2 ring-gold-bright" : "opacity-60 ring-1 ring-passport-rule hover:opacity-100",
                    )}
                  >
                    <Image src={image.thumbnailUrl || image.url} alt="" fill sizes="48px" className="object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!placeholder && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-11 text-sm whitespace-nowrap text-passport-ink-2 underline decoration-1 decoration-passport-rule underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-gold-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              View full size
            </button>
          )}
        </figcaption>
      )}
    </figure>
  );
}
