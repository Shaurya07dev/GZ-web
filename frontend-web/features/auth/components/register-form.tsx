"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Loader2,
  MailCheck,
  UserPlus,
  User,
  Mail,
  Phone,
  Lock,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { AuthCrest } from "./auth-crest";
import { AuthFormHeader } from "./auth-form-header";
import { AuthTextField } from "./auth-text-field";
import { GoogleAuthButton } from "./google-auth-button";
import { AppleAuthButton } from "./apple-auth-button";
import { RoleToggle } from "./role-toggle";
import { DevPanel } from "./dev-panel";
import { useRegisterMutation } from "@/hooks/useAuth";
import {
  registerBaseSchema,
  type RegisterInput,
  type Role,
} from "@/features/auth/schemas/auth-schemas";
import { ROLE_OPTIONS } from "@/features/auth/data/role-options";
import { signIn } from "@/lib/session";

interface RegisterFormProps {
  initialRole?: Role;
}

const STEP_TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const };

const ROLE_TOGGLE_OPTIONS = ROLE_OPTIONS.map((option) => ({
  value: option.role,
  label: option.label,
  icon: option.icon,
}));

export function RegisterForm({ initialRole }: RegisterFormProps) {
  const router = useRouter();
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
      acceptedTerms: false,
      companyName: "",
      contactPerson: "",
    } as unknown as RegisterInput,
  });

  const role = useWatch({ control: form.control, name: "role" });

  function onSubmit(values: RegisterInput) {
    registerMutation.mutate(values, {
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong.",
        );
      },
    });
  }

  if (registerMutation.isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={STEP_TRANSITION}
      >
        <RegisterSuccessPanel email={form.getValues("email")} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={STEP_TRANSITION}
      className="flex flex-col gap-6"
    >
      <AuthCrest />

      <Controller
        control={form.control}
        name="role"
        render={({ field }) => (
          <RoleToggle
            options={ROLE_TOGGLE_OPTIONS}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <AuthFormHeader
        title="Create an account"
        description="Join GalleryZone and showcase your art."
        icon={UserPlus}
      />

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
            icon={User}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuthTextField
              control={form.control}
              name="email"
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              icon={Mail}
            />
            <AuthTextField
              control={form.control}
              name="phone"
              label="Phone number"
              type="tel"
              placeholder="98765 43210"
              autoComplete="tel"
              icon={Phone}
            />
          </div>

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
                    icon={Building2}
                  />
                  <AuthTextField
                    control={form.control}
                    name="contactPerson"
                    label="Contact person"
                    placeholder="Full name"
                    autoComplete="name"
                    icon={User}
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
            placeholder="Min 8 characters, 1 letter, 1 number"
            autoComplete="new-password"
            icon={Lock}
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

          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.role}
                type="button"
                onClick={() => {
                  // No backend, so "demo login" is the same fake-session
                  // write login-form.tsx does on success — skip the form
                  // and drop straight into the (mock-data-driven) dashboard.
                  signIn(option.role);
                  router.push(option.redirectPath);
                }}
                className="flex flex-col items-center gap-1 rounded-lg border border-gold/30 bg-card px-2 py-2.5 text-xs font-medium text-foreground transition-colors hover:border-gold hover:bg-gold/10 active:scale-[0.98]"
              >
                <option.icon className="size-4 text-gold-bright" />
                Demo {option.label}
              </button>
            ))}
          </div>

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

      <div className="flex flex-col gap-5">
        <div className="relative flex items-center" aria-hidden="true">
          <div className="grow border-t border-border" />
          <span className="px-4 text-xs tracking-wide text-muted-foreground">
            OR CONTINUE WITH
          </span>
          <div className="grow border-t border-border" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GoogleAuthButton />
          <AppleAuthButton />
        </div>
      </div>

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
