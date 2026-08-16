"use client";

import { useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { ConfirmActionDialog } from "@/features/admin/confirm-action-dialog";
import {
  useArtistSettings,
  useUpdateArtistSettingsMutation,
} from "@/hooks/useArtistSettings";
import { passwordRule } from "@/features/auth/schemas/auth-schemas";

const NOTIFICATION_TOGGLES = [
  {
    key: "notifyArtworkApproved" as const,
    label: "Artwork approved or rejected",
  },
  { key: "notifyNewSale" as const, label: "New sale" },
  { key: "notifyWithdrawalProcessed" as const, label: "Withdrawal processed" },
  { key: "notifyNewMessage" as const, label: "New message" },
];

export function ArtistSettingsView() {
  const { data: settings } = useArtistSettings();
  const updateMutation = useUpdateArtistSettingsMutation();
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Notifications
        </h2>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {NOTIFICATION_TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm text-foreground">{toggle.label}</span>
              <Switch
                checked={settings?.[toggle.key] ?? false}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({ [toggle.key]: checked })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <SecurityCard />

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Danger zone
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deactivating your account removes your listings from the
          marketplace. This is a mock action in this demo.
        </p>
        <button
          type="button"
          onClick={() => setDeactivateOpen(true)}
          className="mt-3 rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          Deactivate account
        </button>
      </div>

      <ConfirmActionDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate your account?"
        description="This is a mock action — no account is actually deactivated in this demo."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => {
          toast.info("Account deactivation isn't wired up in this demo.");
          setDeactivateOpen(false);
        }}
      />
    </div>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormInput = z.infer<typeof passwordSchema>;

// Client-validated only — there's no real auth backend to check the current
// password against, so this is an honest mock (like GoogleAuthButton),
// reusing the same 8-char/letter/number rule the register form enforces.
function SecurityCard() {
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function onSubmit(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    handleSubmit(() => {
      setSaved(true);
      reset();
    })(e);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Security
      </h2>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <Field data-invalid={Boolean(errors.currentPassword)}>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <Input
            id="currentPassword"
            type="password"
            className="h-10"
            {...register("currentPassword")}
          />
          <FieldError errors={[errors.currentPassword]} />
        </Field>

        <Field data-invalid={Boolean(errors.newPassword)}>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <Input
            id="newPassword"
            type="password"
            className="h-10"
            {...register("newPassword")}
          />
          <FieldError errors={[errors.newPassword]} />
        </Field>

        <Field data-invalid={Boolean(errors.confirmPassword)}>
          <FieldLabel htmlFor="confirmNewPassword">
            Confirm new password
          </FieldLabel>
          <Input
            id="confirmNewPassword"
            type="password"
            className="h-10"
            {...register("confirmPassword")}
          />
          <FieldError errors={[errors.confirmPassword]} />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Update password
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-gold-bright">
              <Check className="size-3.5" />
              Updated
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
