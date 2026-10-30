"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import {
  useCustomerProfile,
  useUpdateProfileMutation,
} from "@/hooks/useCustomerProfile";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferencesMutation,
  type NotificationPreferences,
} from "@/hooks/useNotificationPreferences";
import type { CustomerProfile } from "@/types/customer";

// Deliberately small, per the spec (§4): name/email/phone only. No password
// change (there's no real auth session to change a password against in
// this mock phase) and no notification-preferences toggles -- nothing here
// controls a system that doesn't exist yet.
const profileSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(10, "Enter a valid phone number"),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

export default function AccountSettingsPage() {
  const { data: profile, isPending } = useCustomerProfile();
  const updateMutation = useUpdateProfileMutation();
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset, formState } =
    useForm<ProfileFormValues>({
      resolver: zodResolver(profileSchema),
      defaultValues: { name: "", email: "", phone: "" },
    });

  useEffect(() => {
    if (profile) {
      reset({ name: profile.name, email: profile.email, phone: profile.phone });
    }
  }, [profile, reset]);

  // customerService.updateProfile resolves { ...mockCustomer, ...patch }
  // without persisting it into the shared mockCustomer fixture, so
  // useUpdateProfileMutation's built-in onSuccess (a plain
  // invalidateQueries) alone would refetch the same unedited profile and
  // this form would silently revert right after a "successful" save. This
  // call-site onSuccess runs after that invalidate-triggered refetch
  // settles (see AddressFormDialog's identical note), so writing the
  // mutation's returned value into the ["customer-profile"] cache here is
  // what actually makes the save stick for the rest of the session.
  function onSubmit(values: ProfileFormValues) {
    updateMutation.mutate(values, {
      onSuccess: (updated) => {
        queryClient.setQueryData<CustomerProfile>(
          ["customer-profile"],
          updated,
        );
        reset(values);
        toast.success("Profile updated");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Profile
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the name, email, and phone number on your account.
        </p>
      </div>

      <div className="max-w-lg rounded-lg border border-border bg-card p-5">
        {isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            <FieldGroup className="gap-4">
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="name">Full name</FieldLabel>
                    <Input
                      id="name"
                      className="h-10"
                      {...field}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      className="h-10"
                      {...field}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input
                      id="phone"
                      className="h-10"
                      {...field}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateMutation.isPending || !formState.isDirty}
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <NotificationPreferencesCard />
    </div>
  );
}

function NotificationPreferencesCard() {
  const { data: prefs, isPending } = useNotificationPreferences();
  const update = useUpdateNotificationPreferencesMutation();

  function toggle(key: keyof NotificationPreferences, next: boolean) {
    update.mutate(
      { [key]: next },
      {
        onError: (error) => toast.error(error.message),
      },
    );
  }

  const items: {
    key: keyof NotificationPreferences;
    title: string;
    description: string;
  }[] = [
    {
      key: "abandonedCart",
      title: "Abandoned cart reminders",
      description: "Email us if you added a piece to your cart but didn't check out.",
    },
    {
      key: "marketing",
      title: "News and announcements",
      description: "Platform updates, new artist drops, feature releases.",
    },
    {
      key: "weeklyDigest",
      title: "Weekly digest",
      description: "A once-a-week roundup of marketplace activity.",
    },
    {
      key: "pushEnabled",
      title: "Push notifications",
      description: "Allow pushes on devices you've signed in to.",
    },
  ];

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-xl font-semibold text-foreground">
        Notifications
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Transactional emails like order confirmations, invoices, and password
        resets are always sent — these controls only cover reminders and
        news.
      </p>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        {isPending || !prefs ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : (
          items.map((item) => (
            <label
              key={item.key}
              htmlFor={`notif-${item.key}`}
              className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <input
                id={`notif-${item.key}`}
                type="checkbox"
                checked={prefs[item.key]}
                disabled={update.isPending}
                onChange={(e) => toggle(item.key, e.target.checked)}
                className="mt-1 size-4 accent-gold-bright"
              />
            </label>
          ))
        )}
      </div>
    </div>
  );
}
