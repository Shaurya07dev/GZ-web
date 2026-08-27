import {
  artistConnectionsCol,
  CURRENT_ARTIST_ID,
  CURRENT_ARTIST_NAME,
} from "@/lib/mock-collections";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  involvesArtist,
  type ArtistConnection,
} from "@/types/artist-network";
import { ARTIST } from "@/features/dashboard/dashboard-data";
import { mockArtists } from "@/lib/mock-data/artists";

// Artist-to-artist connections. Same shape as every other
// service here: fixture data behind mockDelay, persisted through
// lib/mock-collections.ts. The rules live in this file, not in the components,
// so a stale tab cannot get around a hidden button.
//
// Ratings used to live here too and no longer do — see artistRatingService.

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function artistDisplay(artistId: string): { name: string; avatar: string } {
  if (artistId === CURRENT_ARTIST_ID) {
    return { name: CURRENT_ARTIST_NAME, avatar: ARTIST.avatar };
  }
  const artist = mockArtists.find((a) => a.id === artistId);
  return {
    name: artist?.name ?? artistId,
    avatar: artist?.profileImageUrl ?? ARTIST.avatar,
  };
}

// A connection exists for a pair regardless of who asked — checking only one
// direction is how you end up with two "pending" rows for the same two people.
function findBetween(
  connections: ArtistConnection[],
  a: string,
  b: string,
): ArtistConnection | undefined {
  return connections.find(
    (c) =>
      (c.requesterId === a && c.recipientId === b) ||
      (c.requesterId === b && c.recipientId === a),
  );
}

export const artistNetworkService = {
  // --- Connections ---------------------------------------------------------

  listConnections: (artistId: string): Promise<ArtistConnection[]> =>
    mockDelay(
      artistConnectionsCol
        .get()
        .filter((c) => involvesArtist(c, artistId))
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    ),

  /** The viewer's connection with one other artist, if any. */
  getConnectionWith: (
    viewerId: string,
    peerId: string,
  ): Promise<ArtistConnection | null> =>
    mockDelay(findBetween(artistConnectionsCol.get(), viewerId, peerId) ?? null),

  sendConnectionRequest: (input: {
    requesterId: string;
    recipientId: string;
    message?: string;
  }): Promise<ArtistConnection> => {
    if (input.requesterId === input.recipientId)
      return mockError("You cannot connect with yourself");

    const connections = artistConnectionsCol.get();
    const existing = findBetween(
      connections,
      input.requesterId,
      input.recipientId,
    );
    // A declined request can be sent again; a pending or accepted one cannot.
    if (existing && existing.status !== "declined")
      return mockError(
        existing.status === "accepted"
          ? "You are already connected"
          : "There is already a request open with this artist",
      );

    const requester = artistDisplay(input.requesterId);
    const recipient = artistDisplay(input.recipientId);
    const connection: ArtistConnection = {
      id: nextId("conn"),
      requesterId: input.requesterId,
      requesterName: requester.name,
      requesterAvatar: requester.avatar,
      recipientId: input.recipientId,
      recipientName: recipient.name,
      recipientAvatar: recipient.avatar,
      status: "pending",
      message: input.message?.trim() ?? "",
      requestedAt: nowIso(),
      respondedAt: null,
    };

    artistConnectionsCol.set([
      ...connections.filter((c) => c.id !== existing?.id),
      connection,
    ]);
    return mockDelay(connection);
  },

  // Only the recipient answers a request. The sender withdrawing it is a
  // different action and is not built — nobody has asked for it.
  respondToConnection: (input: {
    connectionId: string;
    viewerId: string;
    accept: boolean;
  }): Promise<ArtistConnection> => {
    const connections = artistConnectionsCol.get();
    const connection = connections.find((c) => c.id === input.connectionId);
    if (!connection) return mockError("Request not found");
    if (connection.recipientId !== input.viewerId)
      return mockError("Only the person who received a request can answer it");
    if (connection.status !== "pending")
      return mockError("That request has already been answered");

    const updated: ArtistConnection = {
      ...connection,
      status: input.accept ? "accepted" : "declined",
      respondedAt: nowIso(),
    };
    artistConnectionsCol.set(
      connections.map((c) => (c.id === updated.id ? updated : c)),
    );
    return mockDelay(updated);
  },
};
