"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { AuthFormHeader } from "./auth-form-header";
import { AuthTextField } from "./auth-text-field";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { useResetPasswordMutation } from "@/hooks/useAuth";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/features/auth/schemas/auth-schemas";

interface ResetPasswordFormProps {
  token: string;
}

const TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const resetPasswordMutation = useResetPasswordMutation();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const password = form.watch("password");

  function onSubmit(values: ResetPasswordInput) {
    resetPasswordMutation.mutate({ ...values, token });
  }

  if (resetPasswordMutation.isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={TRANSITION}
        className="flex flex-col items-center gap-5 text-center"
      >
        <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <CheckCircle2 className="size-6 text-gold-bright" strokeWidth={1.5} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Password reset
          </h1>
          <p className="text-balance text-sm leading-relaxed text-muted-foreground">
            Your password has been updated. Sign in with your new password.
          </p>
        </div>
        <Button
          className="h-10 w-full max-w-[220px]"
          render={<Link href="/login" />}
        >
          Continue to Login
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION}
      className="flex flex-col gap-6"
    >
      <AuthFormHeader
        title="Set a new password"
        description="Choose a strong password you haven't used before."
      />
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
        <FieldGroup>
          <div className="flex flex-col gap-2">
            <AuthTextField
              control={form.control}
              name="password"
              label="New password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <AuthTextField
            control={form.control}
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
          />
          <Button
            type="submit"
            disabled={resetPasswordMutation.isPending}
            className="mt-1 h-10 w-full"
          >
            {resetPasswordMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Reset password
          </Button>
        </FieldGroup>
      </form>
    </motion.div>
  );
}
