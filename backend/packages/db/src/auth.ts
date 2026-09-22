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
import { DbError } from "./errors.ts";

export class AuthError extends DbError {}

function authService() {
  const app = getApps()[0];
  if (!app) throw new AuthError("Firebase app not initialized — call createDb() first");
  return getAuth(app);
}

/** Firebase-hosted action links; callers extract the oobCode and build their own page URL. */
export function generatePasswordResetLink(email: string, continueUrl: string): Promise<string> {
  return authService().generatePasswordResetLink(email, { url: continueUrl, handleCodeInApp: false });
}
export function generateEmailVerificationLink(email: string, continueUrl: string): Promise<string> {
  return authService().generateEmailVerificationLink(email, { url: continueUrl, handleCodeInApp: false });
}
export async function userRecordByEmail(email: string): Promise<{ uid: string; displayName: string | null; emailVerified: boolean } | null> {
  try {
    const u = await authService().getUserByEmail(email);
    return { uid: u.uid, displayName: u.displayName ?? null, emailVerified: u.emailVerified };
  } catch {
    return null;
  }
}

export interface VerifiedUser {
  uid: string;
  email: string | null;
  /** Provider-supplied display name (Google etc.) — a default for the profile, never authoritative. */
  name: string | null;
}

/** Verifies a client-supplied Firebase ID token. Throws if invalid/expired. */
export async function verifyIdToken(idToken: string): Promise<VerifiedUser> {
  try {
    const decoded = await authService().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null, name: typeof decoded.name === "string" ? decoded.name : null };
  } catch (error) {
    throw new AuthError(`Invalid or expired ID token: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Roles a person can self-select at sign-up. `admin` is granted by hand in the Firestore console, never via a public route. */
export type SelfServeRole = Exclude<UserRole, "admin">;

export interface CreateUserProfileInput {
  email: string;
  name: string;
  role: SelfServeRole;
  phone?: string | null | undefined;
}

/**
 * Writes the Firestore side of an account for an EXISTING Firebase Auth
 * user: users/{uid} (+ publicProfiles/{uid} for artists) and the role
 * custom claim. Shared by password sign-up (registerUser) and the OAuth
 * bootstrap route, where Google/Apple already created the Auth user and
 * only the profile is missing. Throws AuthError if users/{uid} exists —
 * a role is chosen once, at sign-up, and never rewritten through this path.
 */
export async function createUserProfile(
  db: Firestore,
  uid: string,
  { email, name, role, phone = null }: CreateUserProfileInput,
): Promise<void> {
  const userRef = db.collection(Collections.users).doc(uid);
  if ((await userRef.get()).exists) throw new AuthError(`User ${uid} already has a profile`);

  await authService().setCustomUserClaims(uid, { role, grants: [] });

  const userDoc: UserDoc = {
    firebaseUid: uid,
    role,
    status: "pending",
    name,
    email,
    phone,
    createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    lastLoginAt: null,
    roleGrants: [],
  };
  await userRef.set(userDoc);

  if (role === "artist") {
    const publicProfile: PublicProfileDoc = { name, headline: null, bio: null, location: null, profileImageUrl: null };
    await db.collection(Collections.publicProfiles).doc(uid).set(publicProfile);
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
  { email, password, name, role, phone = null }: CreateUserProfileInput & { password: string },
): Promise<{ uid: string }> {
  const auth = authService();
  const userRecord = await auth.createUser({ email, password, displayName: name });

  try {
    await createUserProfile(db, userRecord.uid, { email, name, role, phone });
  } catch (error) {
    await auth.deleteUser(userRecord.uid).catch(() => {}); // best-effort cleanup — don't mask the original error
    throw error;
  }

  return { uid: userRecord.uid };
}

/** Public view of users/{uid} — what GET /v1/auth/me returns. Never includes anything the guard wouldn't already have read. */
export interface CurrentUser {
  uid: string;
  role: UserRole;
  status: UserDoc["status"];
  name: string;
  email: string;
  phone: string | null;
  roleGrants: string[];
}

/** Reads the caller's own profile and stamps lastLoginAt. Null if no users/{uid} doc (OAuth user who hasn't bootstrapped yet). */
export async function getCurrentUser(db: Firestore, uid: string, { touchLogin = true } = {}): Promise<CurrentUser | null> {
  const userRef = db.collection(Collections.users).doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) return null;
  const user = snap.data() as UserDoc;
  if (touchLogin) await userRef.update({ lastLoginAt: FieldValue.serverTimestamp() });
  return {
    uid,
    role: user.role,
    status: user.status,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    roleGrants: user.roleGrants ?? [],
  };
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
