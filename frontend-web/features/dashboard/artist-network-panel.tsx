"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, UserPlus, Users, X } from "lucide-react";
import {
  useArtistConnections,
  useRespondToConnectionMutation,
} from "@/hooks/useArtistNetwork";
import { CURRENT_ARTIST_ID } from "@/lib/mock-collections";
import {
  connectionDirection,
  connectionPeer,
  type ArtistConnection,
} from "@/types/artist-network";

// The people this artist is connected to, on their profile page: requests
// waiting on them, requests they have sent, and the ones that stuck.

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export function ArtistNetworkPanel() {
  const { data: connections } = useArtistConnections(CURRENT_ARTIST_ID);
  const rows = connections ?? [];

  const incoming = rows.filter(
    (c) =>
      c.status === "pending" &&
      connectionDirection(c, CURRENT_ARTIST_ID) === "incoming",
  );
  const outgoing = rows.filter(
    (c) =>
      c.status === "pending" &&
      connectionDirection(c, CURRENT_ARTIST_ID) === "outgoing",
  );
  const accepted = rows.filter((c) => c.status === "accepted");

  return (
    <div className="flex flex-col gap-6 lg:col-span-2">
      <ConnectionsSection
        incoming={incoming}
        outgoing={outgoing}
        accepted={accepted}
      />
    </div>
  );
}

// --- Connections ------------------------------------------------------------

function ConnectionsSection({
  incoming,
  outgoing,
  accepted,
}: {
  incoming: ArtistConnection[];
  outgoing: ArtistConnection[];
  accepted: ArtistConnection[];
}) {
  const respond = useRespondToConnectionMutation();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Users className="size-4 text-gold-bright" strokeWidth={1.75} />
          <h2 className="font-display text-base font-semibold text-foreground">
            Connections
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {accepted.length} connected
          {incoming.length > 0 && ` · ${incoming.length} waiting on you`}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Connect with other GalleryZone artists from their public profile. Once
        you are connected you can propose a collaboration.
      </p>

      {errorMessage(respond.error) && (
        <p className="text-sm text-destructive">{errorMessage(respond.error)}</p>
      )}

      {incoming.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Requests
          </p>
          {incoming.map((connection) => {
            const peer = connectionPeer(connection, CURRENT_ARTIST_ID);
            return (
              <div
                key={connection.id}
                className="flex flex-wrap items-start gap-3 rounded-md border border-gold/30 bg-gold/5 p-3.5"
              >
                <PeerAvatar name={peer.name} avatar={peer.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {peer.name}
                  </p>
                  {connection.message && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      &ldquo;{connection.message}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    Asked {formatDate(connection.requestedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={respond.isPending}
                    onClick={() =>
                      respond.mutate({
                        connectionId: connection.id,
                        viewerId: CURRENT_ARTIST_ID,
                        accept: true,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-gold-bright to-gold px-3.5 py-2 text-xs font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
                  >
                    <Check className="size-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={respond.isPending}
                    onClick={() =>
                      respond.mutate({
                        connectionId: connection.id,
                        viewerId: CURRENT_ARTIST_ID,
                        accept: false,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                  >
                    <X className="size-3.5" />
                    Ignore
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {accepted.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Connected artists
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {accepted.map((connection) => {
              const peer = connectionPeer(connection, CURRENT_ARTIST_ID);
              return (
                <Link
                  key={connection.id}
                  href={`/artists/${peer.id}`}
                  className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-gold/40"
                >
                  <PeerAvatar name={peer.name} avatar={peer.avatar} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {peer.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Connected {formatDate(connection.respondedAt ?? connection.requestedAt)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-md border border-dashed border-border px-3.5 py-3">
          <UserPlus
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.5}
          />
          <p className="text-xs text-muted-foreground">
            No connections yet.{" "}
            <Link href="/artists" className="text-gold-bright hover:underline">
              Browse artists
            </Link>{" "}
            and send a request from their profile.
          </p>
        </div>
      )}

      {outgoing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Waiting on{" "}
          {outgoing
            .map((c) => connectionPeer(c, CURRENT_ARTIST_ID).name)
            .join(", ")}
          .
        </p>
      )}
    </section>
  );
}

function PeerAvatar({ name, avatar }: { name: string; avatar: string }) {
  return (
    <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-gold/30">
      <Image src={avatar} alt={name} fill sizes="36px" className="object-cover" />
    </span>
  );
}
