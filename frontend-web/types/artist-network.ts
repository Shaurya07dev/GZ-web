// Artist-to-artist connections.
//
// Deliberately separate from types/artist-rating.ts: a rating is a COLLECTOR's
// view of an artist, earned on a sale. These are how artists relate to each
// other. They shared a file once and it made both harder to reason about.

export type ConnectionStatus = "pending" | "accepted" | "declined";

// Stored once per pair, from the sender's point of view. Whether it reads as
// incoming or outgoing depends on who is looking — see connectionDirection().
export interface ArtistConnection {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string;
  recipientId: string;
  recipientName: string;
  recipientAvatar: string;
  status: ConnectionStatus;
  /** Optional note the requester attached. */
  message: string;
  requestedAt: string; // ISO
  respondedAt: string | null;
}

export type ConnectionDirection = "incoming" | "outgoing";

export function connectionDirection(
  connection: ArtistConnection,
  viewerId: string,
): ConnectionDirection {
  return connection.recipientId === viewerId ? "incoming" : "outgoing";
}

/** The other person, whichever end of the request the viewer is on. */
export function connectionPeer(
  connection: ArtistConnection,
  viewerId: string,
): { id: string; name: string; avatar: string } {
  return connection.recipientId === viewerId
    ? {
        id: connection.requesterId,
        name: connection.requesterName,
        avatar: connection.requesterAvatar,
      }
    : {
        id: connection.recipientId,
        name: connection.recipientName,
        avatar: connection.recipientAvatar,
      };
}

export function involvesArtist(
  connection: ArtistConnection,
  artistId: string,
): boolean {
  return (
    connection.requesterId === artistId || connection.recipientId === artistId
  );
}
