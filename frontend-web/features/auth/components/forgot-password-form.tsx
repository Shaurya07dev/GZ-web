"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { AuthFormHeader } from "./auth-form-header";
import { AuthTextField } from "./auth-text-field";
import { DevPanel } from "./dev-panel";
import { useForgotPasswordMutation } from "@/hooks/useAuth";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/features/auth/schemas/auth-schemas";

const TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

export function ForgotPasswordForm() {
  const forgotPasswordMutation = useForgotPasswordMutation();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordInput) {
    // Deliberately no simulateError path wired up here (see
    // services/authService.ts's forgotPassword comment): this screen never
    // confirms or denies whether an account exists for the address, so the
    // only meaningful UI states are "form" and "sent" — real security
    // practice, not a mock-phase shortcut (spec §3).
    forgotPasswordMutation.mutate(values);
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {forgotPasswordMutation.isSuccess ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TRANSITION}
          className="flex flex-col items-center gap-5 text-center"
        >
          <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <MailCheck className="size-6 text-gold-bright" strokeWidth={1.5} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-2xl font-semibold text-foreground">
              Check your email
            </h1>
            <p className="text-balance text-sm leading-relaxed text-muted-foreground">
              If an account exists for{" "}
              <span className="font-medium text-foreground">
                {form.getValues("email")}
              </span>
              , we&rsquo;ve sent a link to reset your password.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-bright hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
          <DevPanel className="mt-1">
            <span className="text-xs text-muted-foreground">
              Skip the real email
            </span>
            <Link
              href="/reset-password?token=mock"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
            >
              Dev: skip to reset form
            </Link>
          </DevPanel>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TRANSITION}
          className="flex flex-col gap-6"
        >
          <AuthFormHeader
            title="Forgot your password?"
            description="Enter your email and we'll send you a link to reset it."
          />
          <form
            onSubmit={form.handleSubmit(onSubmit)}
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
              <Button
                type="submit"
                disabled={forgotPasswordMutation.isPending}
                className="mt-1 h-10 w-full"
              >
                {forgotPasswordMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Send reset link
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
      )}
    </AnimatePresence>
  );
}
