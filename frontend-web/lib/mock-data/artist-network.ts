import type {
  ArtistCollaboration,
  ArtistConnection,
  ArtistReview,
  StarRating,
} from "@/types/artist-network";
import { mockArtists } from "./artists";
import { ARTIST } from "@/features/dashboard/dashboard-data";

// Ratings, connections and collaborations for the demo. There is no backend,
// so nothing here is earned at runtime: reviews are seeded, and the write
// paths (send a request, accept it, propose a collaboration) act on this seed.
//
// The demo artist ("devika-rao") is deliberately mid-table rather than a
// perfect five — an artist looking at their own rating card needs to see what
// a mixed one looks like, and admin needs a spread to sort by.

const DEMO_ARTIST_ID = "devika-rao";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

interface ReviewSeed {
  artistId: string;
  reviewerName: string;
  rating: StarRating;
  artworkTitle: string;
  comment: string;
  daysAgo: number;
}

const REVIEW_SEEDS: ReviewSeed[] = [
  {
    artistId: DEMO_ARTIST_ID,
    reviewerName: "Aarav Shah",
    rating: 5,
    artworkTitle: "Whispers in Bronze",
    comment:
      "Arrived exactly as photographed, packed properly, and the certificate was in the box. Would buy again.",
    daysAgo: 112,
  },
  {
    artistId: DEMO_ARTIST_ID,
    reviewerName: "Nandini Verma",
    rating: 5,
    artworkTitle: "Monsoon Reverie",
    comment:
      "The colour is richer in person than on screen. She answered two questions before I bought, which decided it for me.",
    daysAgo: 61,
  },
  {
    artistId: DEMO_ARTIST_ID,
    reviewerName: "Karthik Menon",
    rating: 4,
    artworkTitle: "Fragments of Dawn",
    comment:
      "Beautiful piece. Shipping took a few days longer than the estimate, otherwise no complaints.",
    daysAgo: 34,
  },
  {
    artistId: DEMO_ARTIST_ID,
    reviewerName: "Sanjana Rao",
    rating: 4,
    artworkTitle: "Eclipse of Thoughts",
    comment:
      "Saw it at the gallery before buying. Framed well and ready to hang straight away.",
    daysAgo: 21,
  },
  {
    artistId: DEMO_ARTIST_ID,
    reviewerName: "Imran Qureshi",
    rating: 3,
    artworkTitle: "Monsoon Reverie",
    comment:
      "Good work, but the dimensions read larger on the listing than the piece felt on the wall.",
    daysAgo: 9,
  },
  // The seven public artists, so the admin table has a real spread to sort.
  { artistId: "meera-nair", reviewerName: "Aarav Shah", rating: 5, artworkTitle: "Coastal Elegy", comment: "Layered and quiet. Exactly what the process video promised.", daysAgo: 140 },
  { artistId: "meera-nair", reviewerName: "Divya Pillai", rating: 5, artworkTitle: "Before the Rain", comment: "Second purchase from Meera. Consistent quality both times.", daysAgo: 74 },
  { artistId: "meera-nair", reviewerName: "Rahul Nanda", rating: 4, artworkTitle: "Coastal Elegy", comment: "Lovely canvas, minor scuff on the frame corner in transit.", daysAgo: 30 },
  { artistId: "arjun-mehta", reviewerName: "Tara Bhatia", rating: 5, artworkTitle: "Reclaimed Stone Vessel", comment: "The finish is extraordinary up close. Worth the wait.", daysAgo: 96 },
  { artistId: "arjun-mehta", reviewerName: "Vikram Sethi", rating: 5, artworkTitle: "Cast Bronze Study", comment: "Heavy, solid, beautifully documented from block to polish.", daysAgo: 45 },
  { artistId: "kavya-iyer", reviewerName: "Aditi Roy", rating: 4, artworkTitle: "Ink Field No. 2", comment: "Delicate work. Packaging could have been sturdier.", daysAgo: 58 },
  { artistId: "kavya-iyer", reviewerName: "Neel Kapadia", rating: 4, artworkTitle: "Ink Field No. 5", comment: "Happy with it. Communication was slow but the piece is right.", daysAgo: 12 },
  { artistId: "rohan-bhattacharya", reviewerName: "Meghna Das", rating: 3, artworkTitle: "Salvaged Frequencies", comment: "Interesting piece, arrived with a corner abrasion that was resolved.", daysAgo: 52 },
  { artistId: "ananya-deshmukh", reviewerName: "Farhan Ali", rating: 5, artworkTitle: "Density Study, Karol Bagh", comment: "Bold and much larger than I expected. Delighted.", daysAgo: 80 },
  { artistId: "ananya-deshmukh", reviewerName: "Shreya Kulkarni", rating: 4, artworkTitle: "Terrace Light", comment: "Great colour. Took a while to ship from the gallery.", daysAgo: 25 },
  { artistId: "ishaan-kapoor", reviewerName: "Ritu Malhotra", rating: 4, artworkTitle: "Static Bloom", comment: "Fresh work from a new artist. Certificate arrived promptly.", daysAgo: 18 },
  { artistId: "priya-subramaniam", reviewerName: "Gaurav Iyer", rating: 5, artworkTitle: "Thread Count", comment: "Textile work that photographs badly and looks superb in person.", daysAgo: 66 },
  { artistId: "priya-subramaniam", reviewerName: "Leela Menon", rating: 5, artworkTitle: "Warp and Weft", comment: "Immaculate. She included a handwritten note about the dye process.", daysAgo: 38 },
];

export const mockArtistReviews: ArtistReview[] = REVIEW_SEEDS.map(
  (seed, i) => ({
    id: `rev-${i + 1}`,
    artistId: seed.artistId,
    reviewerName: seed.reviewerName,
    rating: seed.rating,
    comment: seed.comment,
    artworkTitle: seed.artworkTitle,
    createdAt: daysAgo(seed.daysAgo),
  }),
);

function publicArtist(id: string) {
  const artist = mockArtists.find((a) => a.id === id);
  if (!artist) throw new Error(`mock-data/artist-network: unknown artist "${id}"`);
  return artist;
}

// One accepted connection so the demo artist has a peer to collaborate with,
// and one incoming request waiting on them so Accept/Ignore has something to
// act on the first time the page is opened.
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

export const mockArtistCollaborations: ArtistCollaboration[] = [
  {
    id: "collab-1",
    proposerId: "meera-nair",
    proposerName: publicArtist("meera-nair").name,
    partnerId: DEMO_ARTIST_ID,
    partnerName: ARTIST.name,
    title: "Two Coasts",
    brief:
      "A paired series — six canvases each, hung as alternating pairs, on the monsoon light either side of the peninsula.",
    status: "proposed",
    proposedAt: daysAgo(6),
    respondedAt: null,
  },
];
