"use client";

import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import {
  artworkEditState,
  ARTWORK_EDIT_WINDOW_DAYS,
} from "@/types/artwork";
import { useArtistDashboardArtworks } from "@/hooks/useArtistArtworks";
import { ArtworkSubmitForm } from "./artwork-submit-form";

// Reads the artist's own list rather than fetching one artwork: the list is
// already cached from My Artworks, and a submission made this session only
// exists in the browser's mock database anyway.
export function ArtworkEditView({ artworkId }: { artworkId: string }) {
  const { data: artworks, isPending } = useArtistDashboardArtworks();

  if (isPending) {
    return <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />;
  }

  const artwork = (artworks ?? []).find((a) => a.id === artworkId);

  if (!artwork) {
    return (
      <Notice
        title="Artwork not found"
        body="It may have been removed, or it belongs to another artist."
      />
    );
  }

  const editState = artworkEditState(artwork);

  if (!editState.editable) {
    return (
      <Notice
        title={
          editState.reason === "purchased"
            ? "This artwork can no longer be edited"
            : "The edit window has closed"
        }
        body={
          editState.reason === "purchased"
            ? `"${artwork.title}" has been claimed or sold, so its details are locked. Contact support if something needs correcting.`
            : `Listings can be edited for ${ARTWORK_EDIT_WINDOW_DAYS} days after going live. That window has passed for "${artwork.title}" — contact support if something needs correcting.`
        }
        locked
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/artworks"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold-bright"
        >
          <ArrowLeft className="size-3.5" />
          My Artworks
        </Link>
        <p className="text-sm text-muted-foreground">
          {editState.reason === "draft"
            ? "This is still a draft — edit freely until you submit it."
            : `${editState.daysLeft} ${editState.daysLeft === 1 ? "day" : "days"} left in the edit window. Editing stops immediately if someone buys or claims this piece.`}
        </p>
      </div>

      <ArtworkSubmitForm artwork={artwork} />
    </div>
  );
}

function Notice({
  title,
  body,
  locked = false,
}: {
  title: string;
  body: string;
  locked?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-8">
      {locked && (
        <span className="flex size-10 items-center justify-center rounded-full border border-border bg-secondary">
          <Lock className="size-4 text-muted-foreground" />
        </span>
      )}
      <h2 className="font-display text-xl font-semibold text-foreground">
        {title}
      </h2>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      <Link
        href="/dashboard/artworks"
        className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gold-bright hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Back to My Artworks
      </Link>
    </div>
  );
}
