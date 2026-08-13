"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthFormHeader } from "./auth-form-header";
import { useVerifyEmailMutation } from "@/hooks/useAuth";

interface VerifyEmailStatusProps {
  token?: string;
}

const REDIRECT_COUNTDOWN_SECONDS = 3;
const TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

export function VerifyEmailStatus({ token }: VerifyEmailStatusProps) {
  const router = useRouter();
  const verifyEmailMutation = useVerifyEmailMutation();
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS);

  // Fires once per token, and again whenever "Resend" re-triggers it — the
  // mutation itself carries the loading/success/error state, so this
  // effect's only job is kicking it off.
  useEffect(() => {
    verifyEmailMutation.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!verifyEmailMutation.isSuccess) return;
    // Resetting the countdown here (rather than at declaration) is what lets
    // "Resend" restart the same 3-2-1 sequence on a second success.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(REDIRECT_COUNTDOWN_SECONDS);
    const interval = setInterval(() => {
      setCountdown((current) => Math.max(current - 1, 0));
    }, 1000);
    const timeout = setTimeout(() => {
      router.push("/login");
    }, REDIRECT_COUNTDOWN_SECONDS * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyEmailMutation.isSuccess]);

  function handleResend() {
    verifyEmailMutation.mutate({ token });
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {verifyEmailMutation.isPending && (
        <motion.div
          key="verifying"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
          className="flex flex-col items-center gap-5 text-center"
        >
          <Loader2
            className="size-8 animate-spin text-gold-bright"
            strokeWidth={1.5}
          />
          <AuthFormHeader
            title="Verifying your email…"
            description="This should only take a moment."
          />
        </motion.div>
      )}

      {verifyEmailMutation.isSuccess && (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TRANSITION}
          className="flex flex-col items-center gap-5 text-center"
        >
          <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <CheckCircle2
              className="size-6 text-gold-bright"
              strokeWidth={1.5}
            />
          </span>
          <AuthFormHeader
            title="Email verified"
            description={`Redirecting you to sign in in ${countdown}s…`}
          />
          <Button
            className="h-10 w-full max-w-[220px]"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Continue to Login
          </Button>
        </motion.div>
      )}

      {verifyEmailMutation.isError && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={TRANSITION}
          className="flex flex-col items-center gap-5 text-center"
        >
          <span className="flex size-14 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
            <MailWarning
              className="size-6 text-destructive"
              strokeWidth={1.5}
            />
          </span>
          <AuthFormHeader
            title="This link is invalid or has expired"
            description="Verification links only work once. Request a fresh one below."
          />
          <Button
            onClick={handleResend}
            disabled={verifyEmailMutation.isPending}
            className="h-10 w-full max-w-[220px]"
          >
            Resend verification email
          </Button>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to sign in
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
