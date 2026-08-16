"use client";

import Image from "next/image";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck, Building2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  useAggregatorProfile,
  useUpdateAggregatorProfileMutation,
} from "@/hooks/useAggregatorProfile";

type AggregatorProfileData = NonNullable<
  ReturnType<typeof useAggregatorProfile>["data"]
>;

const profileSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name"),
  contactPerson: z.string().trim().min(2, "Enter a contact person"),
  gstNumber: z.string().trim().length(15, "GST number must be 15 characters"),
  phone: z.string().trim().min(10, "Enter a valid phone number"),
  addressLine1: z.string().trim().min(5, "Enter your business address"),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

// Mirrors artistDashboardService.updateBankDetails's masking contract:
// only the last 4 digits are ever persisted/displayed, so the full number
// never round-trips to the mock backend.
const bankSchema = z.object({
  bankAccountNumber: z.string().trim().min(4, "Enter your account number"),
  ifsc: z
    .string()
    .trim()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
});
type BankFormValues = z.infer<typeof bankSchema>;

// Fetches, then hands off to ProfileFormBody once loaded — same
// query-backed-form pattern as features/dashboard/profile-kyc-form.tsx
// (ProfileFormBody only ever mounts after `profile` exists, so its forms
// can seed local state straight from the loaded data).
export function ProfileForm() {
  const { data: profile } = useAggregatorProfile();

  if (!profile) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-80 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    );
  }

  return <ProfileFormBody profile={profile} />;
}

function ProfileFormBody({ profile }: { profile: AggregatorProfileData }) {
  const updateProfileMutation = useUpdateAggregatorProfileMutation();
  const updateBankMutation = useUpdateAggregatorProfileMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      companyName: profile.companyName,
      contactPerson: profile.contactPerson,
      gstNumber: profile.gstNumber,
      phone: profile.phone,
      addressLine1: profile.addressLine1,
    },
  });

  function onProfileSubmit(values: ProfileFormValues) {
    updateProfileMutation.mutate(values, {
      onError: (error) => toast.error(error.message),
    });
  }

  const {
    control: bankControl,
    handleSubmit: handleBankSubmit,
    reset: resetBank,
    formState: { errors: bankErrors, isSubmitting: isBankSubmitting },
  } = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: { bankAccountNumber: "", ifsc: profile.ifsc },
  });

  function onBankSubmit(values: BankFormValues) {
    const last4 = values.bankAccountNumber.slice(-4);
    updateBankMutation.mutate(
      { bankAccountMasked: `•••• •••• •••• ${last4}`, ifsc: values.ifsc },
      {
        onSuccess: () => {
          toast.success("Bank details updated");
          resetBank({ bankAccountNumber: "", ifsc: values.ifsc });
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <form
        onSubmit={handleSubmit(onProfileSubmit)}
        className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6"
      >
        <h2 className="font-display text-base font-semibold text-foreground">
          Company profile
        </h2>

        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-gold/40">
            <Image
              src={profile.avatar}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {profile.companyName}
            </p>
            <p className="text-xs text-muted-foreground">
              Shown to GalleryZone admin and support.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.companyName)}>
            <FieldLabel htmlFor="companyName">Company name</FieldLabel>
            <Input
              id="companyName"
              className="h-10"
              {...register("companyName")}
              aria-invalid={Boolean(errors.companyName)}
            />
            <FieldError errors={[errors.companyName]} />
          </Field>

          <Field data-invalid={Boolean(errors.contactPerson)}>
            <FieldLabel htmlFor="contactPerson">Contact person</FieldLabel>
            <Input
              id="contactPerson"
              className="h-10"
              {...register("contactPerson")}
              aria-invalid={Boolean(errors.contactPerson)}
            />
            <FieldError errors={[errors.contactPerson]} />
          </Field>

          <Controller
            control={control}
            name="gstNumber"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="gstNumber">GST number</FieldLabel>
                <Input
                  id="gstNumber"
                  maxLength={15}
                  className="h-10 font-mono uppercase"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Field data-invalid={Boolean(errors.phone)}>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              type="tel"
              className="h-10"
              {...register("phone")}
              aria-invalid={Boolean(errors.phone)}
            />
            <FieldError errors={[errors.phone]} />
          </Field>

          <Field data-invalid={Boolean(errors.addressLine1)} className="sm:col-span-2">
            <FieldLabel htmlFor="addressLine1">Business address</FieldLabel>
            <Input
              id="addressLine1"
              className="h-10"
              {...register("addressLine1")}
              aria-invalid={Boolean(errors.addressLine1)}
            />
            <FieldError errors={[errors.addressLine1]} />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting || updateProfileMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
          >
            {updateProfileMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save profile
          </button>
          {updateProfileMutation.isSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-gold-bright">
              <Check className="size-3.5" />
              Saved
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">
              Security deposit
            </h2>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <ShieldCheck className="size-3" />
              Active
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Held per your onboarding MOU and refunded after a final audit if
            you exit the program. This is managed by GalleryZone admin —
            contact support with questions.
          </p>
        </div>

        <form
          onSubmit={handleBankSubmit(onBankSubmit)}
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <h2 className="font-display text-base font-semibold text-foreground">
            Bank account
          </h2>

          <div className="flex items-center gap-3 rounded-md border border-border p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
              <Building2
                className="size-4 text-gold-bright"
                strokeWidth={1.5}
              />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                <Lock className="size-3 shrink-0 text-muted-foreground" />
                {profile.bankAccountMasked}
              </p>
              <p className="text-xs text-muted-foreground">Currently on file</p>
            </div>
          </div>

          <Controller
            control={bankControl}
            name="bankAccountNumber"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="bankAccountNumber">
                  New account number
                </FieldLabel>
                <Input
                  id="bankAccountNumber"
                  inputMode="numeric"
                  placeholder="Enter to update"
                  className="h-10"
                  {...field}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            control={bankControl}
            name="ifsc"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="ifsc">IFSC code</FieldLabel>
                <Input
                  id="ifsc"
                  maxLength={11}
                  className="h-10"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isBankSubmitting || updateBankMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gold/50 px-5 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-40"
            >
              {updateBankMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Update bank details
            </button>
            {updateBankMutation.isSuccess && (
              <span className="flex items-center gap-1.5 text-sm text-gold-bright">
                <Check className="size-3.5" />
                Updated
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
