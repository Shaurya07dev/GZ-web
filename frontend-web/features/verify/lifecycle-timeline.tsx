"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LifecycleEntry, LifecycleKind } from "@/services/verifyService";

// The piece's provenance (NFC_IMPLEMENTATION.md §6): one record of everything that happened to it, made, approved,
// listed, shown at a gallery, sold, handed over, delivered, from the server's merged `lifecycle` array, oldest
// first. It replaces the old provenance list, which only knew about ownership transfers.
//
// A place appears only under the artist and a gallery. For a collector the server sends null (a collector's home
// is private), so there is nothing here to hide or to leak.
//
// Design: the record is a thread, not a list of cards. Each step is a small diamond (the same mark that divides
// the certificate's title from its text) on one hairline, with the date in its own column so the dates read as a
// ledger. The latest step is the only one filled in gold. The thread draws itself down once, as it scrolls into
// view (see .pp-thread in globals.css); without JS or with reduced motion it is simply there.

const LABEL: Record<LifecycleKind, (name: string) => string> = {
  created: (name) => `Made by ${name}`,
  approved: () => "Approved by GalleryZone",
  listed: () => "Listed on the marketplace",
  placed_with_gallery: (name) => `On display at ${name}`,
  returned_from_gallery: (name) => `Came back from ${name}`,
  sold_marketplace: (name) => `Sold to ${name}`,
  sold_at_gallery: (name) => `Sold at ${name}`,
  transferred: (name) => `Handed over to ${name}`,
  displayed: (name) => `Lent to ${name} for display`,
  delivered: () => "Delivered to the new owner",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function placeOf(location: NonNullable<LifecycleEntry["location"]>): string {
  return [location.city, location.state, location.country].filter(Boolean).join(", ");
}

export function NfcLifecycleTimeline({ entries }: { entries: LifecycleEntry[] }) {
  const list = useRef<HTMLOListElement>(null);

  // Arm the draw-down only if the record starts below the fold and motion is welcome; fire it once when it arrives.
  // Attributes are set on the element directly so nothing re-renders, and nothing is hidden before this runs.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) return;
    el.setAttribute("data-armed", "");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.setAttribute("data-inview", "");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (entries.length === 0) return null;
  const last = entries.length - 1;

  return (
    <ol ref={list} className="pp-thread flex flex-col">
      {entries.map((entry, i) => {
        const isLast = i === last;
        const date = dateFormat.format(new Date(entry.at));
        return (
          <li
            key={entry.id}
            className="pp-entry grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[6.5rem_1.25rem_minmax(0,1fr)]"
            style={{ "--i": i } as CSSProperties}
          >
            <time dateTime={entry.at} className="hidden pt-px text-right text-sm text-passport-ink-2 tabular-nums sm:block">
              {date}
            </time>

            <div className="relative flex justify-center" aria-hidden="true">
              {!isLast && <span className="pp-line absolute top-4 bottom-0 w-px origin-top bg-passport-rule" style={{ "--i": i } as CSSProperties} />}
              <span className={cn("relative mt-1.5 size-2 rotate-45", isLast ? "bg-gold-bright" : "border border-passport-ink-2 bg-background")} />
            </div>

            <div className={cn("flex flex-col gap-1", !isLast && "pb-9")}>
              <p className="text-base leading-snug font-medium text-foreground">{LABEL[entry.kind](entry.actor.displayName)}</p>
              {entry.location && (
                <p className="flex items-center gap-1.5 text-sm text-passport-ink-2">
                  <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                  {placeOf(entry.location)}
                </p>
              )}
              {entry.note && <p className="text-sm text-passport-ink-2">{entry.note}</p>}
              <time dateTime={entry.at} className="text-sm text-passport-ink-2 tabular-nums sm:hidden">
                {date}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
