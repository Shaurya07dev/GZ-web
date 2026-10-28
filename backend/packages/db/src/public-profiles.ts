// Public artist profile + admin user management — Firestore version.
// Public reads never touch artistPricePaise or PII (that data lives in
// separate subcollections/documents these functions never read from).

import type { Firestore } from "firebase-admin/firestore";
import { Collections, type ArtworkDoc, type PublicProfileDoc, type UserDoc, type UserRole, type UserStatus } from "./collections.ts";
import { DbError } from "./errors.ts";

export class ProfileError extends DbError {}

export type PublicSocialPlatform = "website" | "youtube" | "tiktok" | "x";

export interface PublicArtistFields {
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  profileImageUrl: string | null;
  verification: {
    tier1SocialMedia: boolean;
    /** Kept under the existing client field name; this tier is the signed artist agreement. */
    tier2ActivePlan: boolean;
    tier3FirstSale: boolean;
  };
  socialLinks: { platform: PublicSocialPlatform; url: string }[];
}

function safeHttpUrl(raw: string | null | undefined, addScheme = false): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const candidate = addScheme && !/^https?:\/\//i.test(value) ? `https://${value}` : value;
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function videoPlatform(url: URL): Exclude<PublicSocialPlatform, "website"> | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) return "youtube";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) return "x";
  return null;
}

/** Convert the safe public projection into the one API shape both clients use. */
export function publicArtistFields(profile: PublicProfileDoc): PublicArtistFields {
  const socialLinks: PublicArtistFields["socialLinks"] = [];
  const website = safeHttpUrl(profile.website, true);
  if (website) socialLinks.push({ platform: "website", url: website.toString() });
  const video = safeHttpUrl(profile.socialProofVideoUrl);
  const platform = video ? videoPlatform(video) : null;
  if (video && platform) socialLinks.push({ platform, url: video.toString() });
  return {
    name: profile.name,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    profileImageUrl: profile.profileImageUrl,
    verification: {
      tier1SocialMedia: profile.tier1SocialMedia ?? false,
      tier2ActivePlan: profile.tier2ArtistAgreement ?? false,
      tier3FirstSale: profile.tier3FirstSale ?? false,
    },
    socialLinks,
  };
}

export interface PublicArtistProfile extends PublicArtistFields {
  id: string;
  artworkCount: number;
}

export interface PublicArtistCard extends PublicArtistProfile {
  /** Cover image of the newest live listing, for the directory card. */
  coverImageUrl: string | null;
}

/** Artists with at least one live marketplace piece, most listings first. One query on the projection, no per-artist reads. */
export async function listPublicArtists(db: Firestore): Promise<PublicArtistCard[]> {
  const live = await db.collection(Collections.artworks).where("listing.onMarketplace", "==", true).get();
  const byArtist = new Map<string, { count: number; cover: string | null; newest: number }>();
  for (const doc of live.docs) {
    const a = doc.data() as ArtworkDoc;
    const createdAt = a.createdAt?.toMillis() ?? 0;
    const cur = byArtist.get(a.artistId) ?? { count: 0, cover: null, newest: -1 };
    cur.count += 1;
    if (createdAt > cur.newest) {
      cur.newest = createdAt;
      cur.cover = a.listing?.coverImageUrl ?? cur.cover;
    }
    byArtist.set(a.artistId, cur);
  }
  const ids = [...byArtist.keys()];
  if (!ids.length) return [];
  const profiles = await Promise.all(ids.map((id) => db.collection(Collections.publicProfiles).doc(id).get()));
  return profiles
    .flatMap((snap, i) => {
      if (!snap.exists) return [];
      const p = snap.data() as PublicProfileDoc;
      const stats = byArtist.get(ids[i]!)!;
      return [{ id: ids[i]!, ...publicArtistFields(p), artworkCount: stats.count, coverImageUrl: stats.cover }];
    })
    .sort((a, b) => b.artworkCount - a.artworkCount || a.name.localeCompare(b.name));
}

/** Headline numbers for the About page — what is actually on the platform. */
export async function publicStats(db: Firestore): Promise<{ artworksListed: number; artistsOnboard: number; mediums: number; categories: number }> {
  const [live, artists] = await Promise.all([
    db.collection(Collections.artworks).where("listing.onMarketplace", "==", true).select("medium", "category").get(),
    db.collection(Collections.users).where("role", "==", "artist").where("status", "==", "active").count().get(),
  ]);
  const mediums = new Set<string>();
  const categories = new Set<string>();
  for (const d of live.docs) {
    const a = d.data() as { medium?: string; category?: string };
    if (a.medium) mediums.add(a.medium);
    if (a.category) categories.add(a.category);
  }
  return { artworksListed: live.size, artistsOnboard: artists.data().count, mediums: mediums.size, categories: categories.size };
}

export async function getPublicArtistProfile(db: Firestore, artistId: string): Promise<PublicArtistProfile> {
  const snap = await db.collection(Collections.publicProfiles).doc(artistId).get();
  if (!snap.exists) throw new ProfileError(`No artist ${artistId}`);
  const profile = snap.data() as PublicProfileDoc;

  const countSnap = await db.collection(Collections.artworks).where("artistId", "==", artistId).count().get();

  return {
    id: artistId,
    ...publicArtistFields(profile),
    artworkCount: countSnap.data().count,
  };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

export async function listUsers(db: Firestore, role?: UserRole): Promise<AdminUserRow[]> {
  let query = db.collection(Collections.users) as FirebaseFirestore.Query;
  if (role) query = query.where("role", "==", role);
  const snap = await query.get();
  return snap.docs.map((d) => {
    const data = d.data() as UserDoc;
    return { id: d.id, name: data.name, email: data.email, role: data.role, status: data.status, createdAt: data.createdAt.toDate() };
  });
}

export async function setUserStatus(db: Firestore, userId: string, status: UserStatus): Promise<void> {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw new ProfileError(`No user ${userId}`);
  await ref.update({ status });
}

// The "TR" flag: this artist is listing through an external platform, not
// through GalleryZone directly. Admin-only; drives a badge in internal views
// so a reviewer can tell at a glance where the artist came from.
export async function setUserExternalArtist(db: Firestore, userId: string, externalArtist: boolean): Promise<void> {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw new ProfileError(`No user ${userId}`);
  if ((snap.data() as UserDoc).role !== "artist") throw new ProfileError(`User ${userId} is not an artist`);
  await ref.update({ externalArtist });
}

// GalleryZone's own rating of an artist, 0-10, set by an admin. One of the
// three factors in the artist's composite score — buyer ratings and profile
// completion are the other two. Admin-only input; the backend ensures the
// user is an artist, and the value is clamped to the valid range.
export async function setUserGalleryzoneRating(db: Firestore, userId: string, rating: number | null): Promise<void> {
  const userRef = db.collection(Collections.users).doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new ProfileError(`No user ${userId}`);
  if ((userSnap.data() as UserDoc).role !== "artist") throw new ProfileError(`User ${userId} is not an artist`);
  const clamped = rating === null ? null : Math.max(0, Math.min(10, rating));
  const profileRef = db.collection(`users/${userId}/profile`).doc("data");
  await profileRef.set({ galleryzoneRating: clamped }, { merge: true });
}
