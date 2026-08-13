import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/authService";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/features/auth/schemas/auth-schemas";

// Thin useMutation wrappers, one per authService method (SAD §5.3's
// Page -> Hook -> Service pattern). Components call these, never
// authService directly, so loading/error state stays centralized in
// TanStack Query exactly as it would against a real backend.

export function useLoginMutation() {
  return useMutation({
    mutationFn: (input: LoginInput & { simulateError?: boolean }) =>
      authService.login(input),
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterInput & { simulateError?: boolean }) =>
      authService.register(input),
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput & { simulateError?: boolean }) =>
      authService.forgotPassword(input),
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (
      input: ResetPasswordInput & { token?: string; simulateError?: boolean },
    ) => authService.resetPassword(input),
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: (input: { token?: string; simulateError?: boolean }) =>
      authService.verifyEmail(input),
  });
}
