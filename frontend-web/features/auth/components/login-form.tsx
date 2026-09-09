"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Loader2,
  LogIn,
  Mail,
  Lock,
  Palette,
  Building2,
  Compass,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import type { z } from "zod";
import { AuthCrest } from "./auth-crest";
import { AuthFormHeader } from "./auth-form-header";
import { AuthTextField } from "./auth-text-field";
import { GoogleAuthButton } from "./google-auth-button";
import { AppleAuthButton } from "./apple-auth-button";
import { RoleToggle } from "./role-toggle";
import { DevPanel } from "./dev-panel";
import { useLoginMutation } from "@/hooks/useAuth";
import { ROLE_SECTION_HOME, SESSION_COOKIE, signIn } from "@/lib/session";
import {
  loginSchema,
  type LoginInput,
  type Role,
} from "@/features/auth/schemas/auth-schemas";

// `rememberMe`'s `.default(false)` in the schema makes it optional on the
// Zod *input* type but required on the parsed *output* type (LoginInput).
// zodResolver's Resolver is typed against that input shape, so useForm
// needs the same split (input for the field values RHF actually holds,
// LoginInput for what handleSubmit hands back after Zod applies the
// default) — otherwise the resolver and useForm's generics disagree on
// whether rememberMe is optional.
type LoginFormValues = z.input<typeof loginSchema>;

// Login-only: Register's `Role` is the three self-service account types
// (admin is ops staff, not something anyone signs up for), but this toggle
// doubles as "sign in as" for a phase with no real backend to carry a
// stored role — so Admin is added here to make /admin reachable at all.
type DemoRole = Role | "admin";

// This toggle is the only signal this mock phase has for "which dashboard
// should a successful login land on" — there is no real backend to carry
// that information, so it's the actual "sign in as" control, not a hidden
// dev affordance. Where each role lands lives in lib/session.ts, shared with
// the route guard so the two can't disagree.

const ROLE_TOGGLE_OPTIONS: {
  value: DemoRole;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "artist", label: "Artist", icon: Palette },
  { value: "aggregator", label: "Aggregator", icon: Building2 },
  { value: "customer", label: "Customer", icon: Compass },
  { value: "admin", label: "Admin", icon: ShieldCheck },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
};

export function LoginForm() {
  const router = useRouter();
  const loginMutation = useLoginMutation();
  const [demoRole, setDemoRole] = useState<DemoRole>("artist");
  const [simulateError, setSimulateError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginFormValues, undefined, LoginInput>({
    resolver: zodResolver(loginSchema),
    // Checked by default: someone signing in expects to still be signed in
    // when they come back later, not to be handed the login form again.
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  function onSubmit(values: LoginInput) {
    setFormError(null);
    loginMutation.mutate(
      { ...values, simulateError },
      {
        onSuccess: () => {
          // Fake session (see lib/session.ts): no backend to issue a real
          // token, so signing in writes the chosen role to a cookie that
          // proxy.ts reads on every request. Unticking "Keep me signed in"
          // downgrades it to a browser-session cookie that dies on close.
          if (values.rememberMe) {
            signIn(demoRole);
          } else {
            document.cookie = `${SESSION_COOKIE}=${demoRole}; path=/; samesite=lax`;
          }
          router.push(ROLE_SECTION_HOME[demoRole]);
        },
        onError: (error) => {
          setFormError(
            error instanceof Error ? error.message : "Something went wrong.",
          );
        },
      },
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-6"
    >
      <motion.div variants={itemVariants}>
        <AuthCrest />
      </motion.div>

      <motion.div variants={itemVariants}>
        <RoleToggle
          options={ROLE_TOGGLE_OPTIONS}
          value={demoRole}
          onChange={setDemoRole}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <AuthFormHeader
          title="Welcome back"
          description="Pick your role above, then sign in to continue."
          icon={LogIn}
        />
      </motion.div>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <motion.form
        variants={itemVariants}
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-5"
      >
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
          name="password"
          label="Password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          icon={Lock}
        />

        <div className="flex items-center justify-between">
          <Controller
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <Field orientation="horizontal" className="w-fit gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <FieldContent>
                  <FieldLabel htmlFor="rememberMe" className="font-normal">
                    Keep me signed in
                  </FieldLabel>
                </FieldContent>
              </Field>
            )}
          />
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-gold-bright hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={loginMutation.isPending}
          className="mt-1 h-10 w-full"
        >
          {loginMutation.isPending && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Sign in
        </Button>

        <DevPanel>
          <span className="text-xs text-muted-foreground">
            Simulate invalid credentials
          </span>
          <Checkbox
            checked={simulateError}
            onCheckedChange={(checked) => setSimulateError(checked === true)}
          />
        </DevPanel>
      </motion.form>

      <motion.div variants={itemVariants} className="flex flex-col gap-5">
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
      </motion.div>

      <motion.p
        variants={itemVariants}
        className="text-center text-sm text-muted-foreground"
      >
        Don&rsquo;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-gold-bright hover:underline"
        >
          Create one
        </Link>
      </motion.p>
    </motion.div>
  );
}
