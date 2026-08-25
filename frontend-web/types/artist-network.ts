// Artist-to-artist connections, and the collaborations that grow out of them.
// A connection is what makes a collaboration possible, so they live together.
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

export type CollaborationStatus =
  | "proposed"
  | "active"
  | "completed"
  | "declined";

// A joint piece or show between two artists who are already connected. Same
// two-sided storage as a connection: one record, read from either end.
export interface ArtistCollaboration {
  id: string;
  proposerId: string;
  proposerName: string;
  partnerId: string;
  partnerName: string;
  title: string;
  brief: string;
  status: CollaborationStatus;
  proposedAt: string; // ISO
  respondedAt: string | null;
}

export function collaborationPeerName(
  collaboration: ArtistCollaboration,
  viewerId: string,
): string {
  return collaboration.proposerId === viewerId
    ? collaboration.partnerName
    : collaboration.proposerName;
}

export const COLLABORATION_STATUS_LABEL: Record<CollaborationStatus, string> = {
  proposed: "Proposed",
  active: "Active",
  completed: "Completed",
  declined: "Declined",
};
