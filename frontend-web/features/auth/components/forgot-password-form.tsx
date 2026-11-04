"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AuthFormHeader } from "./auth-form-header";
import { AuthTextField } from "./auth-text-field";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas/auth-schemas";
import { authService } from "@/services/authService";

const TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Forgot password — OTP flow (3 Nov 2026). The user enters their email,
 * we send a six-digit code via Resend. On the second screen the user types
 * the code AND their new password at once; the server verifies the OTP and
 * applies the new password in a single request. One shot, no interim token.
 *
 * Non-committal: the "code sent" state renders whether or not an account
 * exists for the email, so the UI can't be used to probe which addresses
 * are registered.
 */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [sentEmail, setSentEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function handleSendCode(values: ForgotPasswordInput) {
    setSending(true);
    try {
      await authService.sendEmailOtp({ email: values.email, purpose: "password_reset" });
      setSentEmail(values.email);
      setStep("reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setSending(false);
    }
  }

  async function handleReset() {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code we emailed you.");
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Password must be at least 8 characters with a letter and a number.");
      return;
    }
    setError(null);
    setResetting(true);
    try {
      await authService.resetPasswordWithOtp({ email: sentEmail, code, password });
      toast.success("Password reset. You can sign in now.");
      router.push("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setResetting(false);
    }
  }

  async function handleResendCode() {
    setSending(true);
    try {
      await authService.sendEmailOtp({ email: sentEmail, purpose: "password_reset" });
      toast.success("We've sent a new code.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === "email" ? (
        <motion.div
          key="email"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TRANSITION}
          className="flex flex-col gap-6"
        >
          <AuthFormHeader
            title="Forgot your password?"
            description="Enter your email and we'll send you a 6-digit code."
            icon={Mail}
          />
          <form
            onSubmit={form.handleSubmit(handleSendCode)}
            noValidate
            className="flex flex-col gap-5"
          >
            <FieldGroup>
              <AuthTextField
                control={form.control}
                name="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Button type="submit" disabled={sending} className="mt-1 h-10 w-full">
                {sending && <Loader2 className="size-4 animate-spin" />}
                Send code
              </Button>
            </FieldGroup>
          </form>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </motion.div>
      ) : (
        <motion.div
          key="reset"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TRANSITION}
          className="flex flex-col gap-6"
        >
          <AuthFormHeader
            title="Enter the code"
            description={
              `If ${sentEmail} is on an account, we've sent a 6-digit code. Enter it with a new password.`
            }
            icon={ShieldCheck}
          />
          <div className="flex flex-col gap-4">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="code">6-digit code</FieldLabel>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-11 text-center text-xl tracking-widest"
                placeholder="••••••"
                disabled={resetting}
              />
            </Field>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters, with a letter and a number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                disabled={resetting}
              />
              {error && <FieldError errors={[{ message: error }]} />}
            </Field>
            <Button onClick={handleReset} disabled={resetting || code.length !== 6}>
              {resetting && <Loader2 className="size-4 animate-spin" />}
              Reset password
            </Button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={sending || resetting}
              className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
            >
              Didn't get the code? Resend
            </button>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
