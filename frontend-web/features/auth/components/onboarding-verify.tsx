"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { AuthCrest } from "./auth-crest";
import { AuthFormHeader } from "./auth-form-header";
import { authService } from "@/services/authService";
import { ROLE_SECTION_HOME, type SessionRole } from "@/lib/session";

/**
 * The two-step verification screen that follows email+password sign-up and
 * Google sign-up. Shown as its own page at `/onboarding/verify` so refresh,
 * back and share-link all behave sensibly; the register-form and Google
 * bootstrap both push the user here with ?email= and ?role= in the URL.
 *
 * Step 1 — email OTP:
 *   On mount, we call /email-otp/send once (the backend has its own hourly
 *   cap so a refresh won't flood). The user types the six-digit code we
 *   mailed, we verify, mark their email verified server-side.
 *   Skipped for Google sign-ups (?emailVerified=1) — Google already
 *   handed us a verified email.
 *
 * Step 2 — phone OTP:
 *   The user enters their mobile number. We call /phone-otp/send. The
 *   user types the SMS code, we verify and store the number on their
 *   account. Can be skipped — the phone number is a convenience, not a
 *   gate — but we encourage completing it so order updates land.
 *
 * On completion we route to the role's landing page, same as the existing
 * post-register redirect.
 */

type Step = "email" | "phone" | "done";

function landingFor(role: SessionRole | null): string {
  if (role === "artist") return "/dashboard/profile";
  if (role === "aggregator") return "/aggregator/profile";
  if (role === "customer") return "/marketplace";
  return ROLE_SECTION_HOME[role ?? "customer"];
}

export function OnboardingVerify() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const role = (params.get("role") as SessionRole | null) ?? null;
  const emailAlreadyVerified = params.get("emailVerified") === "1";

  const [step, setStep] = useState<Step>(emailAlreadyVerified ? "phone" : "email");
  const [emailCode, setEmailCode] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fire the email OTP exactly once per mount. The backend already caps
  // five sends per hour; the UI gives a Resend button for the second one.
  useEffect(() => {
    if (step !== "email" || !email) return;
    void authService.sendEmailOtp({ email, purpose: "signup" }).catch((e) => {
      toast.error(e instanceof Error ? e.message : "Couldn't send the code.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResendEmail() {
    try {
      setBusy(true);
      await authService.sendEmailOtp({ email, purpose: "signup" });
      toast.success("We've sent a new code.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyEmail() {
    if (!/^\d{6}$/.test(emailCode)) {
      setError("Enter the 6-digit code we emailed you.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authService.verifyEmailOtp({ email, code: emailCode, purpose: "signup" });
      toast.success("Email confirmed");
      setStep("phone");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendPhone() {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authService.sendPhoneOtp({ phone: digits });
      setPhoneSent(true);
      toast.success("Code sent via SMS");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the SMS.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyPhone() {
    if (!/^\d{6}$/.test(phoneCode)) {
      setError("Enter the 6-digit code we SMS'd you.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authService.verifyPhoneOtp({ phone, code: phoneCode });
      toast.success("Phone confirmed");
      router.push(landingFor(role));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  function handleSkipPhone() {
    // Phone is useful (order SMS updates land there) but not a gate. A
    // user can finish later from account settings.
    toast.message("Add your mobile from Account later for order updates.");
    router.push(landingFor(role));
  }

  if (!email) {
    return (
      <div className="flex flex-col gap-6">
        <AuthCrest />
        <p className="text-sm text-destructive">
          The link is missing the email address. Please sign in or sign up again.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <AuthCrest />
      <AuthFormHeader
        title={step === "email" ? "Confirm your email" : "Add your phone"}
        description={
          step === "email"
            ? `We've sent a 6-digit code to ${email}. Enter it below to confirm this address.`
            : "A verified mobile means your order updates land directly. We'll send you a 6-digit SMS code."
        }
        icon={step === "email" ? Mail : Phone}
      />

      {step === "email" && (
        <div className="flex flex-col gap-4">
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="email-code">6-digit code</FieldLabel>
            <Input
              id="email-code"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 text-center text-xl tracking-widest"
              placeholder="••••••"
              disabled={busy}
            />
            {error && <FieldError errors={[{ message: error }]} />}
          </Field>
          <Button onClick={handleVerifyEmail} disabled={busy || emailCode.length !== 6}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Confirm email
          </Button>
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={busy}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Didn't get the code? Resend
          </button>
        </div>
      )}

      {step === "phone" && !phoneSent && (
        <div className="flex flex-col gap-4">
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="phone">Mobile number</FieldLabel>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11"
              disabled={busy}
            />
            {error && <FieldError errors={[{ message: error }]} />}
          </Field>
          <Button onClick={handleSendPhone} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
            Send SMS code
          </Button>
          <button
            type="button"
            onClick={handleSkipPhone}
            disabled={busy}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      )}

      {step === "phone" && phoneSent && (
        <div className="flex flex-col gap-4">
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="phone-code">6-digit SMS code</FieldLabel>
            <Input
              id="phone-code"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 text-center text-xl tracking-widest"
              placeholder="••••••"
              disabled={busy}
            />
            {error && <FieldError errors={[{ message: error }]} />}
          </Field>
          <Button onClick={handleVerifyPhone} disabled={busy || phoneCode.length !== 6}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Confirm phone
          </Button>
          <button
            type="button"
            onClick={() => {
              setPhoneSent(false);
              setPhoneCode("");
            }}
            disabled={busy}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Change number
          </button>
        </div>
      )}
    </div>
  );
}
