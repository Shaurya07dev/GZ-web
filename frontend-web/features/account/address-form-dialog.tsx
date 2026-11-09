"use client";

import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customerService } from "@/services/customerService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  FieldContent,
} from "@/components/ui/field";
import {
  useAddAddressMutation,
  useUpdateAddressMutation,
} from "@/hooks/useAddresses";
import type { Address } from "@/types/customer";

// React Hook Form + Controller wrapping Field/FieldLabel/FieldError, per the
// project's Global Constraints (this shadcn style has no real Form
// component) -- mirrors features/aggregator/record-sale-dialog.tsx's
// established pattern exactly.
const addressSchema = z.object({
  line1: z.string().min(3, "Enter the address"),
  line2: z.string().optional(),
  city: z.string().min(2, "Enter the city"),
  state: z.string().min(2, "Enter the state"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  isDefault: z.boolean(),
});
type AddressFormValues = z.infer<typeof addressSchema>;

const EMPTY_VALUES: AddressFormValues = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: false,
};

function toFormValues(address: Address): AddressFormValues {
  return {
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    isDefault: address.isDefault,
  };
}

interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Presence of initialValues is what switches the dialog between add and
  // edit mode -- one component handles both, per the plan.
  initialValues?: Address;
}

export function AddressFormDialog({
  open,
  onOpenChange,
  initialValues,
}: AddressFormDialogProps) {
  const isEditing = Boolean(initialValues);
  const queryClient = useQueryClient();
  const addMutation = useAddAddressMutation();
  const updateMutation = useUpdateAddressMutation();
  const isPending = addMutation.isPending || updateMutation.isPending;

  const { control, handleSubmit, reset, setValue, getValues } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      reset(initialValues ? toFormValues(initialValues) : EMPTY_VALUES);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues?.id]);

  // Watch the pincode so an auto-fill query fires as soon as it is valid.
  // useWatch, not watch(), per the project's React-Compiler pattern.
  const pincodeValue = useWatch({ control, name: "pincode" }) ?? "";
  const isFullPincode = /^\d{6}$/.test(pincodeValue);
  const pincodeLookup = useQuery({
    queryKey: ["pincode-lookup", pincodeValue],
    queryFn: () => customerService.lookupPincode(pincodeValue),
    enabled: isFullPincode,
    staleTime: 86_400_000, // mapping doesn't change on the day scale
    retry: false,
  });

  // Populate city + state when the lookup resolves. Only overwrites empty
  // fields: a buyer who already typed a locality that disagrees with the
  // district label keeps their edit on a re-type.
  //
  // Watching city + state too (not just the lookup) because React Compiler
  // can memoise an effect whose deps only include a query's `.data` and
  // skip re-fires on remount (reopening the dialog for a second address).
  const cityValue = useWatch({ control, name: "city" }) ?? "";
  const stateValue = useWatch({ control, name: "state" }) ?? "";
  useEffect(() => {
    if (!pincodeLookup.data) return;
    if (!cityValue.trim() && pincodeLookup.data.city) {
      setValue("city", pincodeLookup.data.city, { shouldValidate: true });
    }
    if (!stateValue.trim() && pincodeLookup.data.state) {
      setValue("state", pincodeLookup.data.state, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincodeLookup.data?.city, pincodeLookup.data?.state]);

  // customerService.addAddress/updateAddress resolve a plausible next value
  // without persisting it into the shared mockAddresses fixture (see that
  // service file's own header comment) -- so useAddAddressMutation/
  // useUpdateAddressMutation's built-in onSuccess (a plain
  // invalidateQueries) alone would refetch the same static list and the
  // edit would appear to silently do nothing. The call-site onSuccess below
  // runs after that invalidate-triggered refetch settles (TanStack Query
  // awaits hook-level onSuccess before notifying mutate-level onSuccess),
  // so merging the mutation's returned value into the ["addresses"] cache
  // here is what actually makes the add/edit visible for the rest of the
  // session, matching aggregatorService's "the caller's cache update is
  // truth" pattern.
  function onSubmit(values: AddressFormValues) {
    const payload = {
      ...values,
      line2: values.line2?.trim() ? values.line2.trim() : undefined,
    };

    if (isEditing && initialValues) {
      updateMutation.mutate(
        { id: initialValues.id, patch: payload },
        {
          // Only one address can be default at a time -- if this edit set
          // isDefault, every other address in the cache loses it, same
          // one-default invariant the Addresses page's delete-reassignment
          // rule maintains.
          onSuccess: (updated) => {
            queryClient.setQueryData<Address[]>(["addresses"], (prev) => {
              const base = prev ?? [];
              return base.map((a) =>
                a.id === updated.id
                  ? updated
                  : updated.isDefault
                    ? { ...a, isDefault: false }
                    : a,
              );
            });
            toast.success("Address updated");
            onOpenChange(false);
          },
          onError: (error) => toast.error(error.message),
        },
      );
    } else {
      addMutation.mutate(payload, {
        onSuccess: (created) => {
          queryClient.setQueryData<Address[]>(["addresses"], (prev) => {
            const base = prev ?? [];
            const cleared = created.isDefault
              ? base.map((a) => ({ ...a, isDefault: false }))
              : base;
            return [...cleared, created];
          });
          toast.success("Address added");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit address" : "Add address"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the delivery details for this address."
              : "Save a delivery address for faster checkout."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="address-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          <FieldGroup className="gap-4">
            <Controller
              control={control}
              name="line1"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="line1">Address line 1</FieldLabel>
                  <Input
                    id="line1"
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
              name="line2"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="line2">
                    Address line 2 (optional)
                  </FieldLabel>
                  <Input
                    id="line2"
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
              name="pincode"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="pincode">
                    Pincode
                    {pincodeLookup.isFetching && isFullPincode ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        looking up…
                      </span>
                    ) : null}
                  </FieldLabel>
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    maxLength={6}
                    className="h-10"
                    {...field}
                    aria-invalid={fieldState.invalid}
                  />
                  {pincodeLookup.isError && isFullPincode ? (
                    <p className="mt-1 text-xs text-destructive">
                      Couldn&apos;t look up this pincode — type the city and state below.
                    </p>
                  ) : null}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="city"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="city">City</FieldLabel>
                    <Input
                      id="city"
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
                name="state"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="state">State</FieldLabel>
                    <Input
                      id="state"
                      className="h-10"
                      {...field}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <Controller
              control={control}
              name="isDefault"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="isDefault"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="isDefault" className="font-normal">
                      Set as default address
                    </FieldLabel>
                  </FieldContent>
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="address-form" disabled={isPending}>
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Add address"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
