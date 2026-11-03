"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { formatTagUid } from "@/lib/nfc";
import { cn } from "@/lib/utils";
import { verifyUrlFor } from "@/lib/verify-url";

// Two small controls that put an artwork's public address in someone's hand:
//   TagDetails       the artist's line under each tagged piece: the link written to the NFC tag and the
//                    chip's own ID, each with a copy button.
//   ShareRecordButton the collector's button on the public passport: the phone's share sheet where there
//                    is one (WhatsApp is how most people pass a link on), otherwise copy.
// Feedback is the control itself changing, never a toast: the icon swaps to a tick and the label says so.

type CopyState = "idle" | "copied" | "failed";

/** Copies text, with a fallback for pages that are not a secure context (a phone testing against a LAN address). */
function useCopy(text: string): [CopyState, () => Promise<void>] {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      field.remove();
    }
    setState(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2200);
  }

  return [state, copy];
}

function SwapIcon({ copied }: { copied: boolean }) {
  const base = "absolute inset-0 size-4 transition duration-150 ease-[var(--ease-out)] motion-reduce:scale-100";
  return (
    <span className="relative size-4" aria-hidden="true">
      <Copy className={cn(base, copied ? "scale-50 opacity-0" : "scale-100 opacity-100")} strokeWidth={1.75} />
      <Check className={cn(base, "text-gold-bright", copied ? "scale-100 opacity-100" : "scale-50 opacity-0")} strokeWidth={2} />
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, copy] = useCopy(text);
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <SwapIcon copied={state === "copied"} />
      </button>
      <span role="status" className="sr-only">
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : ""}
      </span>
    </>
  );
}

/**
 * What is on a piece's NFC tag: the link written to it (tapping the tag opens exactly this page) and the
 * chip's own ID, the serial number any NFC reader app shows for it. The ID is for the artist and admins,
 * never the public passport: it is all a cloned chip would need (NFC_IMPLEMENTATION.md section 3).
 */
export function TagDetails({ artworkId, tagUid, className }: { artworkId: string; tagUid?: string | null; className?: string }) {
  const url = verifyUrlFor(artworkId);
  const chipId = tagUid ? formatTagUid(tagUid) : null;

  return (
    <dl className={cn("flex flex-wrap items-center gap-x-8 text-xs", className)}>
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
          <Link2 className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          Link on the tag
        </dt>
        <dd className="flex min-w-0 items-center">
          <a
            href={`/verify/${encodeURIComponent(artworkId)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Tapping the tag opens this page"
            className="truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {url.replace(/^https?:\/\//, "")}
          </a>
          <CopyButton text={url} label="Copy the link on the tag" />
        </dd>
      </div>
      {chipId && (
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Chip ID</dt>
          <dd className="flex items-center">
            <span className="tracking-wide text-foreground tabular-nums">{chipId}</span>
            <CopyButton text={chipId} label="Copy the chip ID" />
          </dd>
        </div>
      )}
    </dl>
  );
}

const subscribeNever = () => () => {};
const canShareNow = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export function ShareRecordButton({ url, title, className }: { url: string; title: string; className?: string }) {
  const canShare = useSyncExternalStore(subscribeNever, canShareNow, () => false);
  const [state, copy] = useCopy(url);

  async function handleClick() {
    if (canShare) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the share sheet is a choice, not a failure; anything else falls back to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  }

  const label = state === "copied" ? "Link copied" : state === "failed" ? "Couldn't copy" : canShare ? "Share this record" : "Copy link";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gold/60 px-5 text-sm font-medium whitespace-nowrap text-gold-bright transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring hover:border-gold hover:bg-gold/10",
        className,
      )}
    >
      <SwapIcon copied={state === "copied"} />
      <span aria-live="polite">{label}</span>
    </button>
  );
}
