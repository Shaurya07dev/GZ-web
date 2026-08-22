import {
  artistCollaborationsCol,
  artistConnectionsCol,
  artistProfileCol,
  artistReviewsCol,
  CURRENT_ARTIST_ID,
  CURRENT_ARTIST_NAME,
} from "@/lib/mock-collections";
import { mockDelay, mockError } from "@/lib/mock-utils";
import {
  artistIdFromUserId,
  involvesArtist,
  summarizeRating,
  type ArtistCollaboration,
  type ArtistConnection,
  type ArtistRating,
  type ArtistReview,
} from "@/types/artist-network";
import { ARTIST } from "@/features/dashboard/dashboard-data";
import { mockArtists } from "@/lib/mock-data/artists";

// Artist ratings, artist-to-artist connections and collaborations. Same shape
// as every other service here: fixture data behind mockDelay, persisted
// through lib/mock-collections.ts. The rules live in this file, not in the
// components, so a stale tab cannot get around a hidden button.

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

function isConnected(a: string, b: string): boolean {
  return findBetween(artistConnectionsCol.get(), a, b)?.status === "accepted";
}

/** Signing the MOU is what unlocks collaborations — see MouAgreement. */
function mouSigned(): boolean {
  return artistProfileCol.get().mouAcceptance !== null;
}

export const artistNetworkService = {
  // --- Ratings -------------------------------------------------------------

  getRating: (artistId: string): Promise<ArtistRating> =>
    mockDelay(summarizeRating(artistId, artistReviewsCol.get())),

  listReviews: (artistId: string): Promise<ArtistReview[]> =>
    mockDelay(
      artistReviewsCol
        .get()
        .filter((r) => r.artistId === artistId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),

  // Admin's view: one summary per artist, keyed by the AdminUser id it will
  // be joined against, so the table does not have to know how ids map.
  listRatingsByUserId: (
    userIds: string[],
  ): Promise<Record<string, ArtistRating>> => {
    const reviews = artistReviewsCol.get();
    return mockDelay(
      Object.fromEntries(
        userIds.map((userId) => [
          userId,
          summarizeRating(artistIdFromUserId(userId), reviews),
        ]),
      ),
    );
  },

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

  // --- Collaborations ------------------------------------------------------

  listCollaborations: (artistId: string): Promise<ArtistCollaboration[]> =>
    mockDelay(
      artistCollaborationsCol
        .get()
        .filter((c) => c.proposerId === artistId || c.partnerId === artistId)
        .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt)),
    ),

  proposeCollaboration: (input: {
    proposerId: string;
    partnerId: string;
    title: string;
    brief: string;
  }): Promise<ArtistCollaboration> => {
    // Both gates are enforced here as well as in the UI: the MOU is the
    // agreement that makes joint work possible at all, and a collaboration
    // with someone you are not connected to is not a collaboration.
    if (input.proposerId === CURRENT_ARTIST_ID && !mouSigned())
      return mockError("Sign your MOU before proposing a collaboration");
    if (!isConnected(input.proposerId, input.partnerId))
      return mockError("Connect with this artist first");
    if (!input.title.trim()) return mockError("Give the collaboration a title");
    if (!input.brief.trim()) return mockError("Describe what you have in mind");

    const collaboration: ArtistCollaboration = {
      id: nextId("collab"),
      proposerId: input.proposerId,
      proposerName: artistDisplay(input.proposerId).name,
      partnerId: input.partnerId,
      partnerName: artistDisplay(input.partnerId).name,
      title: input.title.trim(),
      brief: input.brief.trim(),
      status: "proposed",
      proposedAt: nowIso(),
      respondedAt: null,
    };
    artistCollaborationsCol.set([
      ...artistCollaborationsCol.get(),
      collaboration,
    ]);
    return mockDelay(collaboration);
  },

  respondToCollaboration: (input: {
    collaborationId: string;
    viewerId: string;
    accept: boolean;
  }): Promise<ArtistCollaboration> => {
    const all = artistCollaborationsCol.get();
    const collaboration = all.find((c) => c.id === input.collaborationId);
    if (!collaboration) return mockError("Collaboration not found");
    if (collaboration.partnerId !== input.viewerId)
      return mockError("Only the invited artist can answer this");
    if (collaboration.status !== "proposed")
      return mockError("That proposal has already been answered");

    const updated: ArtistCollaboration = {
      ...collaboration,
      status: input.accept ? "active" : "declined",
      respondedAt: nowIso(),
    };
    artistCollaborationsCol.set(
      all.map((c) => (c.id === updated.id ? updated : c)),
    );
    return mockDelay(updated);
  },

  // Either side can mark finished work done; there is nothing to arbitrate.
  completeCollaboration: (input: {
    collaborationId: string;
    viewerId: string;
  }): Promise<ArtistCollaboration> => {
    const all = artistCollaborationsCol.get();
    const collaboration = all.find((c) => c.id === input.collaborationId);
    if (!collaboration) return mockError("Collaboration not found");
    if (
      collaboration.proposerId !== input.viewerId &&
      collaboration.partnerId !== input.viewerId
    )
      return mockError("You are not part of this collaboration");
    if (collaboration.status !== "active")
      return mockError("Only an active collaboration can be completed");

    const updated: ArtistCollaboration = {
      ...collaboration,
      status: "completed",
      respondedAt: nowIso(),
    };
    artistCollaborationsCol.set(
      all.map((c) => (c.id === updated.id ? updated : c)),
    );
    return mockDelay(updated);
  },
};
