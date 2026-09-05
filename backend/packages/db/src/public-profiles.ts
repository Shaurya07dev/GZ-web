// Public artist profile + admin user management. Public reads never touch
// artistPricePaise or PII columns (pan, bankAccountEncrypted, aadhaar*) —
// selected field lists, not row spreads, same discipline as
// artworks.controller.ts's toCustomerDto().

import { count, eq } from "drizzle-orm";
import { userStatusValues, users, profiles, type UserRole, type UserStatus } from "./schema/identity.ts";
import type { Db } from "./client.ts";
import { artworks } from "./schema/artwork.ts";

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

export async function getPublicArtistProfile(db: Db, artistId: string): Promise<PublicArtistProfile> {
  const [row] = await db
    .select({ id: users.id, name: users.name, headline: profiles.headline, bio: profiles.bio, location: profiles.location, profileImageUrl: profiles.profileImageUrl })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, artistId));
  if (!row) throw new ProfileError(`No artist ${artistId}`);

  const [artworkCount] = await db.select({ total: count() }).from(artworks).where(eq(artworks.artistId, artistId));

  return { ...row, artworkCount: artworkCount?.total ?? 0 };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

export async function listUsers(db: Db, role?: UserRole): Promise<AdminUserRow[]> {
  const query = db.select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status, createdAt: users.createdAt }).from(users);
  const rows = role ? await query.where(eq(users.role, role)) : await query;
  return rows as AdminUserRow[];
}

export async function setUserStatus(db: Db, userId: string, status: UserStatus): Promise<void> {
  if (!userStatusValues.includes(status)) throw new ProfileError(`Invalid status ${status}`);
  const result = await db.update(users).set({ status }).where(eq(users.id, userId));
  if (result.count === 0) throw new ProfileError(`No user ${userId}`);
}
