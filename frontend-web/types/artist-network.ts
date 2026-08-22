// Artist ratings, artist-to-artist connections, and the collaborations that
// grow out of them. One module because they are one story: a collector rates
// an artist, artists connect with each other, and a connection is what makes a
// collaboration possible.

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface ArtistReview {
  id: string;
  artistId: string;
  reviewerName: string;
  rating: StarRating;
  comment: string;
  /** The piece the review is about — a rating is always earned on a sale. */
  artworkTitle: string;
  createdAt: string; // ISO
}

export interface ArtistRating {
  artistId: string;
  /** Mean of every review, to one decimal. 0 when there are none. */
  average: number;
  count: number;
  /** How many reviews sat at each star, 5 → 1. Drives the breakdown bars. */
  breakdown: Record<StarRating, number>;
}

export const STAR_VALUES: StarRating[] = [5, 4, 3, 2, 1];

// The one place that turns reviews into a score. The dashboard card, the admin
// table and any future public badge all call this, so they cannot disagree
// about what "4.6" means.
export function summarizeRating(
  artistId: string,
  reviews: ArtistReview[],
): ArtistRating {
  const mine = reviews.filter((r) => r.artistId === artistId);
  const breakdown: Record<StarRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of mine) breakdown[review.rating] += 1;

  if (mine.length === 0) {
    return { artistId, average: 0, count: 0, breakdown };
  }

  const total = mine.reduce((sum, r) => sum + r.rating, 0);
  return {
    artistId,
    average: Math.round((total / mine.length) * 10) / 10,
    count: mine.length,
    breakdown,
  };
}

// Admin lists artists by their AdminUser record, whose id is the artist id
// with a "user-" prefix — except the demo artist, seeded as
// "user-artist-devika-rao" against an artist id of "devika-rao". Both shapes
// resolve here rather than at each call site.
export function artistIdFromUserId(userId: string): string {
  return userId.replace(/^user-/, "").replace(/^artist-/, "");
}

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
