"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Field, FieldContent, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { AuthFormHeader } from "./auth-form-header";
import { AuthTextField } from "./auth-text-field";
import { GoogleAuthButton } from "./google-auth-button";
import { RoleSelectCards } from "./role-select-cards";
import { DevPanel } from "./dev-panel";
import { useRegisterMutation } from "@/hooks/useAuth";
import {
  registerBaseSchema,
  type RegisterInput,
  type Role,
} from "@/features/auth/schemas/auth-schemas";
import { ROLE_OPTIONS } from "@/features/auth/data/role-options";

interface RegisterFormProps {
  initialRole?: Role;
}

const STEP_TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

export function RegisterForm({ initialRole }: RegisterFormProps) {
  const [step, setStep] = useState<"role" | "details">(
    initialRole ? "details" : "role"
  );
  const [simulateError, setSimulateError] = useState(false);
  const registerMutation = useRegisterMutation();

  // z.literal(true) makes RegisterInput["acceptedTerms"] the TS literal
  // `true` (Zod only accepts that exact value, never `false`) — but an
  // unticked checkbox's real starting value is `false`. The cast below is
  // the one place that mismatch is bridged; Controller's onChange is typed
  // (...event: any[]) => void so it accepts `false` at every call site
  // without further casts (verified against the installed react-hook-form
  // types).
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerBaseSchema),
    defaultValues: {
      role: initialRole ?? "artist",
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
      companyName: "",
      contactPerson: "",
    } as unknown as RegisterInput,
  });

  const role = useWatch({ control: form.control, name: "role" });
  const activeRoleOption = ROLE_OPTIONS.find((option) => option.role === role);

  function handleSelectRole(nextRole: Role) {
    form.setValue("role", nextRole, { shouldValidate: true });
    setStep("details");
  }

  function onSubmit(values: RegisterInput) {
    registerMutation.mutate(
      { ...values, simulateError },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Something went wrong."
          );
        },
      }
    );
  }

  const view = registerMutation.isSuccess ? "success" : step;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {view === "success" && (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={STEP_TRANSITION}
        >
          <RegisterSuccessPanel email={form.getValues("email")} />
        </motion.div>
      )}

      {view === "role" && (
        <motion.div
          key="role"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={STEP_TRANSITION}
          className="flex flex-col gap-6"
        >
          <AuthFormHeader
            title="Create your account"
            description="Choose how you'll use GalleryZone. You can change this later."
          />

          <GoogleAuthButton />
          <div className="relative flex items-center" aria-hidden="true">
            <div className="grow border-t border-border" />
            <span className="px-4 text-xs text-muted-foreground">or</span>
            <div className="grow border-t border-border" />
          </div>

          <RoleSelectCards selected={role} onSelect={handleSelectRole} />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-gold-bright hover:underline"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      )}

      {view === "details" && (
        <motion.div
          key="details"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={STEP_TRANSITION}
          className="flex flex-col gap-6"
        >
          <AuthFormHeader
            title={`Create your ${activeRoleOption?.label ?? ""} account`}
            description={activeRoleOption?.description}
          />

          <button
            type="button"
            onClick={() => setStep("role")}
            className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Change role
          </button>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-5"
          >
            <FieldGroup>
              <AuthTextField
                control={form.control}
                name="name"
                label="Full name"
                placeholder="Ananya Rao"
                autoComplete="name"
              />
              <AuthTextField
                control={form.control}
                name="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
              <AuthTextField
                control={form.control}
                name="phone"
                label="Phone number"
                type="tel"
                placeholder="98765 43210"
                autoComplete="tel"
              />

              <AnimatePresence initial={false}>
                {role === "aggregator" && (
                  <motion.div
                    key="aggregator-fields"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <FieldGroup>
                      <AuthTextField
                        control={form.control}
                        name="companyName"
                        label="Company / gallery name"
                        placeholder="Northline Art Space"
                        autoComplete="organization"
                      />
                      <AuthTextField
                        control={form.control}
                        name="contactPerson"
                        label="Contact person"
                        placeholder="Full name"
                        autoComplete="name"
                      />
                    </FieldGroup>
                  </motion.div>
                )}
              </AnimatePresence>

              <AuthTextField
                control={form.control}
                name="password"
                label="Password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
              <AuthTextField
                control={form.control}
                name="confirmPassword"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
              />

              <Controller
                control={form.control}
                name="acceptedTerms"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} orientation="horizontal">
                    <Checkbox
                      id="acceptedTerms"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="acceptedTerms" className="font-normal">
                        I agree to the{" "}
                        <Link
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold-bright underline underline-offset-2 hover:text-gold"
                        >
                          Terms of Service
                        </Link>
                      </FieldLabel>
                      <FieldError errors={[fieldState.error]} />
                    </FieldContent>
                  </Field>
                )}
              />

              <DevPanel>
                <span className="text-xs text-muted-foreground">
                  Simulate duplicate-email error
                </span>
                <Switch
                  checked={simulateError}
                  onCheckedChange={setSimulateError}
                  size="sm"
                />
              </DevPanel>

              <Button
                type="submit"
                disabled={registerMutation.isPending}
                className="mt-1 h-10 w-full"
              >
                {registerMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Create account
              </Button>
            </FieldGroup>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-gold-bright hover:underline"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RegisterSuccessPanel({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
        <MailCheck className="size-6 text-gold-bright" strokeWidth={1.5} />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Check your email
        </h1>
        <p className="text-balance text-sm leading-relaxed text-muted-foreground">
          We&rsquo;ve sent a verification link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Follow
          it to activate your account.
        </p>
      </div>
      <Link
        href="/login"
        className="text-sm font-medium text-gold-bright hover:underline"
      >
        Back to sign in
      </Link>
      <DevPanel className="mt-1">
        <span className="text-xs text-muted-foreground">
          Skip the real email
        </span>
        <Link
          href="/verify-email?token=mock"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
        >
          Dev: skip to email verification
        </Link>
      </DevPanel>
    </div>
  );
}
