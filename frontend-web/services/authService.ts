import {
  applyActionCode,
  confirmPasswordReset,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase";
import { http, isApiError } from "@/lib/api";
import { signIn, signOut, type SessionRole } from "@/lib/session";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  Role,
} from "@/features/auth/schemas/auth-schemas";

// Real auth. Sign-in is a Firebase client SDK flow (email/password or
// Google); the backend never sees a password. What the backend owns is the
// Firestore profile behind users/{uid} — the ONLY authoritative source of
// role/status — reached via:
//   POST /v1/auth/register   email+password sign-up
//   POST /v1/auth/bootstrap  OAuth first login (Auth user exists, profile doesn't)
//   GET  /v1/auth/me         the caller's profile
// After any successful sign-in the role from /me is written to the
// gz_session cookie that proxy.ts guards routes with (lib/session.ts), so
// the route guard and the header keep working exactly as before — just
// fed by the backend instead of a "sign in as" toggle.
//

export interface CurrentUser {
  uid: string;
  role: SessionRole;
  status: "pending" | "active" | "suspended" | "blocked";
  name: string;
  email: string;
  phone: string | null;
  roleGrants: string[];
  /** The signed-in account's profile photo; null until they upload one. */
  photoUrl: string | null;
}

export interface AuthAck {
  email: string;
  role: SessionRole;
}

export interface AuthResult {
  success: true;
}

const CANCELLED_POPUP_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
]);

function firebaseCode(error: unknown): string | null {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : null;
}

// The SDK's messages ("Firebase: Error (auth/invalid-credential).") are
// not for end users. Map the ones a person can actually hit.
function friendlyAuthError(error: unknown): Error {
  switch (firebaseCode(error)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return new Error("Invalid email or password");
    case "auth/too-many-requests":
      return new Error(
        "Too many attempts. Please wait a moment and try again.",
      );
    case "auth/user-disabled":
      return new Error("This account has been disabled.");
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return new Error("This link is invalid or has expired. Request a new one.");
    case "auth/popup-blocked":
      return new Error(
        "Your browser blocked the sign-in window. Allow pop-ups and try again.",
      );
    case "auth/network-request-failed":
      return new Error("Network error. Check your connection and try again.");
    default:
      return error instanceof Error ? error : new Error("Something went wrong.");
  }
}

/** Reads /me and mirrors the role into the session cookie. */
async function establishSession(rememberMe = true): Promise<CurrentUser> {
  const me = await http.get<CurrentUser>("/v1/auth/me");
  signIn(me.role, { persistent: rememberMe });
  return me;
}

export const authService = {
  login: async (
    input: LoginInput,
  ): Promise<AuthAck> => {
    try {
      await signInWithEmailAndPassword(
        firebaseAuth(),
        input.email,
        input.password,
      );
    } catch (error) {
      throw friendlyAuthError(error);
    }
    try {
      const me = await establishSession(input.rememberMe);
      return { email: me.email, role: me.role };
    } catch (error) {
      // Signed in to Firebase but no profile: can't be routed anywhere useful.
      await firebaseSignOut(firebaseAuth()).catch(() => {});
      if (isApiError(error, 401)) {
        throw new Error(
          "No GalleryZone account exists for this sign-in yet. Create one first.",
        );
      }
      throw error;
    }
  },

  /**
   * Google sign-in. On the login page (no `role`) an account must already
   * exist; on the register page the form's chosen role is used to create
   * the profile the first time. Resolves null when the person closed the
   * popup — not an error, just nothing happened.
   */
  loginWithGoogle: async (
    options: { role?: Role; name?: string } = {},
  ): Promise<AuthAck | null> => {
    let credential;
    try {
      credential = await signInWithPopup(firebaseAuth(), googleProvider);
    } catch (error) {
      const code = firebaseCode(error);
      if (code && CANCELLED_POPUP_CODES.has(code)) return null;
      throw friendlyAuthError(error);
    }
    try {
      const me = await establishSession();
      return { email: me.email, role: me.role };
    } catch (error) {
      if (!isApiError(error, 401)) throw error;
      if (!options.role) {
        await firebaseSignOut(firebaseAuth()).catch(() => {});
        throw new Error(
          "No GalleryZone account exists for this Google account yet. Create one first.",
        );
      }
      const me = await http.post<CurrentUser>("/v1/auth/bootstrap", {
        role: options.role,
        name: options.name ?? credential.user.displayName ?? undefined,
      });
      signIn(me.role);
      return { email: me.email, role: me.role };
    }
  },

  register: async (
    input: RegisterInput,
  ): Promise<AuthAck> => {
    // companyName/contactPerson (aggregator) have no backend field yet —
    // the aggregator profile flow captures them later.
    await http.post<{ uid: string }>("/v1/auth/register", {
      email: input.email,
      password: input.password,
      name: input.name,
      role: input.role,
      phone: input.phone,
    });
    try {
      await signInWithEmailAndPassword(
        firebaseAuth(),
        input.email,
        input.password,
      );
    } catch (error) {
      throw friendlyAuthError(error);
    }
    const me = await establishSession();
    return { email: me.email, role: me.role };
  },

  // Non-committal by design: Firebase itself reveals nothing about whether
  // the address belongs to an account (Email Enumeration Protection), and
  // neither does this — the resolved payload is the same either way.
  // The API sends a branded reset email (Resend) whose link lands on
  // /reset-password?token=<oobCode>; it always answers 202 so the UI can't
  // be used to probe which addresses have accounts.
  //
  // Legacy link-based reset. Kept so an old email that already landed in
  // someone's inbox still works; the new flow goes through sendEmailOtp +
  // resetPasswordWithOtp below.
  forgotPassword: async (
    input: ForgotPasswordInput,
  ): Promise<{ email: string }> => {
    await http.post("/v1/auth/password-reset", { email: input.email });
    return { email: input.email };
  },

  // --- OTP flow (3 Nov 2026) -------------------------------------------------
  // Replaces the Firebase email-verification link with a six-digit code the
  // user types on our own screen. Sign-up is unchanged below (register still
  // creates the Firebase user + Firestore profile); after register succeeds
  // the UI calls sendEmailOtp({purpose: "signup"}), waits for the user to
  // type the code, calls verifyEmailOtp. Then the phone-number step kicks
  // in with sendPhoneOtp/verifyPhoneOtp.
  //
  // Password reset is one shot: sendEmailOtp({purpose: "password_reset"})
  // then resetPasswordWithOtp(code, newPassword) — no interim "verify"
  // step, so a leaked verify response doesn't give an attacker a token.

  sendEmailOtp: async (input: {
    email: string;
    purpose: "signup" | "password_reset";
  }): Promise<{ accepted: true }> => {
    await http.post("/v1/auth/email-otp/send", input);
    return { accepted: true };
  },

  verifyEmailOtp: async (input: {
    email: string;
    code: string;
    purpose: "signup" | "password_reset";
  }): Promise<{ verified: true; uid: string | null }> => {
    return http.post("/v1/auth/email-otp/verify", input);
  },

  sendPhoneOtp: async (input: { phone: string }): Promise<{ accepted: true }> => {
    await http.post("/v1/auth/phone-otp/send", input);
    return { accepted: true };
  },

  verifyPhoneOtp: async (input: {
    phone: string;
    code: string;
  }): Promise<{ verified: true }> => {
    return http.post("/v1/auth/phone-otp/verify", input);
  },

  resetPasswordWithOtp: async (input: {
    email: string;
    code: string;
    password: string;
  }): Promise<{ reset: true }> => {
    return http.post("/v1/auth/reset-password", input);
  },

  resendVerification: async (): Promise<void> => {
    await http.post("/v1/auth/resend-verification");
  },

  /**
   * Change the signed-in user's password through Firebase Auth.
   * Firebase requires a fresh credential, so we reauth with the current
   * password before the update — same flow Google/Facebook use. If the
   * current password is wrong, Firebase throws auth/wrong-password and
   * the caller surfaces the message.
   */
  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const user = firebaseAuth().currentUser;
    if (!user || !user.email) {
      throw new Error("You need to be signed in to change your password.");
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await firebaseUpdatePassword(user, newPassword);
    } catch (error) {
      throw friendlyAuthError(error);
    }
  },

  // `token` is Firebase's oobCode from the emailed link (?oobCode=…).
  resetPassword: async (
    input: ResetPasswordInput & { token?: string },
  ): Promise<AuthResult> => {
    if (!input.token) {
      throw new Error("This reset link is missing its code. Request a new one.");
    }
    try {
      await confirmPasswordReset(firebaseAuth(), input.token, input.password);
    } catch (error) {
      throw friendlyAuthError(error);
    }
    return { success: true };
  },

  verifyEmail: async (input: {
    token?: string;
  }): Promise<AuthResult> => {
    if (!input.token) {
      throw new Error("This verification link is missing its code.");
    }
    try {
      await applyActionCode(firebaseAuth(), input.token);
    } catch (error) {
      throw friendlyAuthError(error);
    }
    return { success: true };
  },

  logout: async (): Promise<void> => {
    signOut();
    await firebaseSignOut(firebaseAuth()).catch(() => {});
  },

  /** Current profile, or null when signed out / no profile. */
  me: async (): Promise<CurrentUser | null> => {
    try {
      return await http.get<CurrentUser>("/v1/auth/me");
    } catch (error) {
      if (isApiError(error, 401)) return null;
      throw error;
    }
  },
};
