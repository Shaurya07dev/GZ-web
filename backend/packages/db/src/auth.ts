// Firebase Auth (Admin SDK) integration — register/verify/role management.
// SECURITY (plan.md §5.2's rule, carried over unchanged by the pivot to
// Firestore): authorization decisions are always re-derived from the
// users/{uid} Firestore doc, NEVER trusted from the ID token's own custom
// claims. Custom claims ARE still set (via setUserRole) so the CLIENT SDK
// can make fast, non-authoritative UI decisions (e.g. "show the artist nav"
// before the first Firestore read resolves) — but the server-side
// RolesGuard (apps/api) reads Firestore, not the token, for the real check.

import { getAuth } from "firebase-admin/auth";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";
import { Collections, type PublicProfileDoc, type UserDoc, type UserRole } from "./collections.ts";

export class AuthError extends Error {}

function authService() {
  const app = getApps()[0];
  if (!app) throw new AuthError("Firebase app not initialized — call createDb() first");
  return getAuth(app);
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
}

/** Verifies a client-supplied Firebase ID token. Throws if invalid/expired. */
export async function verifyIdToken(idToken: string): Promise<VerifiedUser> {
  try {
    const decoded = await authService().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (error) {
    throw new AuthError(`Invalid or expired ID token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Registers a new account: creates the Firebase Auth user, the
 * corresponding Firestore users/{uid} + publicProfiles/{uid} docs, and
 * sets the role custom claim. All three happen even though they're not in
 * one atomic transaction (Firebase Auth and Firestore are different
 * services with no shared transaction) — if the Firestore writes fail
 * after the Auth user is created, the auth user is deleted to avoid an
 * orphaned account that can log in but has no profile.
 */
export async function registerUser(
  db: Firestore,
  { email, password, name, role }: { email: string; password: string; name: string; role: UserRole },
): Promise<{ uid: string }> {
  const auth = authService();
  const userRecord = await auth.createUser({ email, password, displayName: name });

  try {
    await auth.setCustomUserClaims(userRecord.uid, { role, grants: [] });

    const userDoc: UserDoc = {
      firebaseUid: userRecord.uid,
      role,
      status: "pending",
      name,
      email,
      phone: null,
      createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
      lastLoginAt: null,
      roleGrants: [],
    };
    await db.collection(Collections.users).doc(userRecord.uid).set(userDoc);

    if (role === "artist") {
      const publicProfile: PublicProfileDoc = { name, headline: null, bio: null, location: null, profileImageUrl: null };
      await db.collection(Collections.publicProfiles).doc(userRecord.uid).set(publicProfile);
    }
  } catch (error) {
    await auth.deleteUser(userRecord.uid).catch(() => {}); // best-effort cleanup — don't mask the original error
    throw error;
  }

  return { uid: userRecord.uid };
}

/** Grants a narrower RBAC permission (e.g. "platform_admin" for the rate-config console) on top of a user's coarse role. */
export async function grantRole(db: Firestore, uid: string, grant: string): Promise<void> {
  const auth = authService();
  const userRef = db.collection(Collections.users).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new AuthError(`No user ${uid}`);
  const user = snap.data() as UserDoc;
  const grants = Array.from(new Set([...(user.roleGrants ?? []), grant]));

  await userRef.update({ roleGrants: grants });
  const authUser = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...(authUser.customClaims ?? {}), grants });
}
