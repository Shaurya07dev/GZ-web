import type { ArtistConnection } from "@/types/artist-network";
import { mockArtists } from "./artists";
import { ARTIST } from "@/features/dashboard/dashboard-data";

// The demo's artist-to-artist graph. There is no backend, so nothing here is
// earned at runtime — the write paths (send a request, accept it) act on this
// seed.

const DEMO_ARTIST_ID = "devika-rao";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function publicArtist(id: string) {
  const artist = mockArtists.find((a) => a.id === id);
  if (!artist) throw new Error(`mock-data/artist-network: unknown artist "${id}"`);
  return artist;
}

// One accepted connection so the demo artist already has a peer, and one
// incoming request waiting on them so Accept/Ignore has something to act on the
// first time the page is opened.
export const mockArtistConnections: ArtistConnection[] = [
  {
    id: "conn-1",
    requesterId: DEMO_ARTIST_ID,
    requesterName: ARTIST.name,
    requesterAvatar: ARTIST.avatar,
    recipientId: "meera-nair",
    recipientName: publicArtist("meera-nair").name,
    recipientAvatar: publicArtist("meera-nair").profileImageUrl,
    status: "accepted",
    message: "We both work coastal light — would be good to compare notes.",
    requestedAt: daysAgo(48),
    respondedAt: daysAgo(47),
  },
  {
    id: "conn-2",
    requesterId: "arjun-mehta",
    requesterName: publicArtist("arjun-mehta").name,
    requesterAvatar: publicArtist("arjun-mehta").profileImageUrl,
    recipientId: DEMO_ARTIST_ID,
    recipientName: ARTIST.name,
    recipientAvatar: ARTIST.avatar,
    status: "pending",
    message:
      "Planning a sculpture-and-canvas pairing for a Jaipur show. Interested?",
    requestedAt: daysAgo(3),
    respondedAt: null,
  },
];
