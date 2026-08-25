"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Clock, UserPlus } from "lucide-react";
import {
  useConnectionWith,
  useSendConnectionRequestMutation,
} from "@/hooks/useArtistNetwork";
import { CURRENT_ARTIST_ID } from "@/lib/mock-collections";
import { readSessionRole, subscribeToSession } from "@/lib/session";

// The LinkedIn-shaped half of artist connections: one button on another
// artist's public profile. The dashboard's Connections panel is the other half
// — it is where a request is accepted.
//
// Only a signed-in artist sees this at all. Collectors and aggregators have no
// use for it, and showing a dead button to a signed-out visitor is worse than
// showing nothing. There is one demo artist account, so "who am I" is that
// artist's id whenever the session says artist.

export function ArtistConnectButton({ artistId }: { artistId: string }) {
  const sessionRole = useSyncExternalStore(
    subscribeToSession,
    readSessionRole,
    () => null,
  );
  const viewerId = sessionRole === "artist" ? CURRENT_ARTIST_ID : null;

  const { data: connection } = useConnectionWith(viewerId, artistId);
  const send = useSendConnectionRequestMutation();
  const [message, setMessage] = useState("");
  const [composing, setComposing] = useState(false);

  // Not an artist, or looking at your own profile — nothing to offer.
  if (!viewerId || viewerId === artistId) return null;

  if (connection?.status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="size-3.5" />
        Connected
      </span>
    );
  }

  if (connection?.status === "pending") {
    const waitingOnMe = connection.recipientId === viewerId;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/5 px-3.5 py-2 text-sm font-medium text-gold-bright">
        <Clock className="size-3.5" />
        {waitingOnMe
          ? "They asked to connect — answer from your profile"
          : "Request sent"}
      </span>
    );
  }

  if (!composing) {
    return (
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gold/50 px-3.5 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
      >
        <UserPlus className="size-3.5" />
        Connect
      </button>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <label htmlFor="connectMessage" className="text-xs text-muted-foreground">
        Add a note (optional)
      </label>
      <textarea
        id="connectMessage"
        rows={2}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="We both work coastal light — would be good to compare notes."
        className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
      {send.error instanceof Error && (
        <p className="text-sm text-destructive">{send.error.message}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={send.isPending}
          onClick={() =>
            send.mutate(
              { requesterId: viewerId, recipientId: artistId, message },
              { onSuccess: () => setComposing(false) },
            )
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-gold-bright to-gold px-4 py-2 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
        >
          Send request
        </button>
        <button
          type="button"
          onClick={() => setComposing(false)}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
