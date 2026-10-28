"use client";

import { ExternalLink, PlayCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Guide } from "@/lib/guides";

// Plays a guide in a dialog instead of navigating to it: most places that
// offer one are halfway through a form, and leaving would lose what was typed.
// The dialog only mounts its content while open, so closing it also ends the
// guide's narration. The frame is sandboxed without same-origin: the guides
// only need to run scripts (and print their notes), nothing of the site.
export function GuideLauncher({
  guide,
  className,
}: {
  guide: Guide;
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-md border border-gold/40 px-3.5 py-3 text-left transition-colors hover:border-gold hover:bg-gold/10 focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none",
              className,
            )}
          />
        }
      >
        <PlayCircle
          className="size-5 shrink-0 text-gold-bright"
          strokeWidth={1.5}
        />
        <span className="min-w-0">
          <span className="block text-xs font-medium text-foreground">
            {guide.title}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {guide.blurb}
          </span>
          <span className="mt-1 block text-[11px] text-gold-bright">
            {guide.meta}
          </span>
        </span>
      </DialogTrigger>

      {/* A fixed-height column, so the frame takes whatever the header and the
          link leave: nearly the whole screen on a phone, where the guide's
          own controls would otherwise sit below the fold. */}
      <DialogContent className="h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:h-[min(92dvh,860px)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{guide.title}</DialogTitle>
          <DialogDescription>{guide.blurb}</DialogDescription>
        </DialogHeader>
        <iframe
          src={guide.src}
          title={guide.title}
          sandbox="allow-scripts allow-modals"
          className="size-full rounded-md border border-border bg-background"
        />
        <a
          href={guide.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-gold-bright hover:underline"
        >
          <ExternalLink className="size-3.5" />
          Open full screen
        </a>
      </DialogContent>
    </Dialog>
  );
}
