// Public artist profile + admin user management — Firestore version.
// Public reads never touch artistPricePaise or PII (that data lives in
// separate subcollections/documents these functions never read from).

import type { Firestore } from "firebase-admin/firestore";
import { Collections, type PublicProfileDoc, type UserDoc, type UserRole, type UserStatus } from "./collections.ts";

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
