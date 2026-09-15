// Public artist profile + admin user management — Firestore version.
// Public reads never touch artistPricePaise or PII (that data lives in
// separate subcollections/documents these functions never read from).

import type { Firestore } from "firebase-admin/firestore";
import { Collections, type ArtworkDoc, type PublicProfileDoc, type UserDoc, type UserRole, type UserStatus } from "./collections.ts";

export class ProfileError extends Error {}

export interface PublicArtistProfile {
  id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  profileImageUrl: string | null;
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
      return [{ id: ids[i]!, name: p.name, headline: p.headline, bio: p.bio, location: p.location, profileImageUrl: p.profileImageUrl, artworkCount: stats.count, coverImageUrl: stats.cover }];
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
    name: profile.name,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    profileImageUrl: profile.profileImageUrl,
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
