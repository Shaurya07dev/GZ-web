import { mockDelay, mockError } from "@/lib/mock-utils";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/features/auth/schemas/auth-schemas";

// Mock auth phase (see plan Global Constraints): there is no real backend,
// so every method here resolves a fixture-shaped acknowledgement after a
// fake delay instead of calling axios. Every method accepts a
// `simulateError?: boolean` dev toggle so each error path is demoable on
// demand from the UI (small dashed-border "DEV" controls in the forms that
// call these) without relying on magic strings for credential-style errors.
// verifyEmail is the one exception — its failure path is driven by the
// `token` itself ("invalid"), because that mirrors how a real bad/expired
// verification link would actually arrive: as a URL, not a form submission.

export interface AuthAck {
  email: string;
}

export interface AuthResult {
  success: true;
}

export const authService = {
  login: (input: LoginInput & { simulateError?: boolean }) => {
    if (input.simulateError) {
      return mockError("Invalid email or password");
    }
    return mockDelay<AuthAck>({ email: input.email });
  },

  register: (input: RegisterInput & { simulateError?: boolean }) => {
    if (input.simulateError) {
      return mockError("That email is already registered");
    }
    return mockDelay<AuthAck>({ email: input.email });
  },

  // Deliberately non-committal even in its own service contract: the
  // resolved payload never signals whether the email actually belongs to an
  // account, and the simulated-error path (unused by the UI in this phase,
  // see ForgotPasswordForm) is a generic transient failure, never an
  // "account not found" message — real security practice, not a shortcut.
  forgotPassword: (input: ForgotPasswordInput & { simulateError?: boolean }) => {
    if (input.simulateError) {
      return mockError("Something went wrong. Please try again.");
    }
    return mockDelay<AuthAck>({ email: input.email });
  },

  resetPassword: (
    input: ResetPasswordInput & { token?: string; simulateError?: boolean }
  ) => {
    if (input.simulateError) {
      return mockError("This reset link has expired. Request a new one.");
    }
    return mockDelay<AuthResult>({ success: true });
  },

  // No Zod schema backs this one (see Task 5 schema list) — there is no
  // user-entered form on this screen, just a token read from the URL.
  verifyEmail: (input: { token?: string; simulateError?: boolean }) => {
    if (input.simulateError || input.token === "invalid") {
      return mockError("This verification link is invalid or has expired.");
    }
    // Slightly longer than the default 600ms mockDelay so the "Verifying…"
    // spinner reads as genuine work rather than a flash (spec: ~1.2s).
    return mockDelay<AuthResult>({ success: true }, 1200);
  },
};
