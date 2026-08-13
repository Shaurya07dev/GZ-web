"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { useRecordSaleMutation } from "@/hooks/useAggregatorCollection";
import type { AggregatorHolding } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";

const recordSaleSchema = z.object({
  soldPrice: z.number({ message: "Enter the sold price" }).positive("Enter a valid price"),
  buyerName: z.string().min(2, "Enter the buyer's name"),
  buyerEmail: z.string().email("Enter a valid email"),
  buyerPhone: z.string().min(10, "Enter a valid phone number"),
  line1: z.string().min(3, "Enter the address"),
  city: z.string().min(2, "Enter the city"),
  state: z.string().min(2, "Enter the state"),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  deliveryMode: z.enum(["courier", "self_pickup"], { message: "Select a delivery mode" }),
});
type RecordSaleFormValues = z.infer<typeof recordSaleSchema>;

const EMPTY_VALUES: RecordSaleFormValues = {
  soldPrice: 0,
  buyerName: "",
  buyerEmail: "",
  buyerPhone: "",
  line1: "",
  city: "",
  state: "",
  pincode: "",
  deliveryMode: "courier",
};

interface RecordSaleDialogProps {
  holding: (AggregatorHolding & { artwork: ArtworkSummary }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fields match POST /aggregators/sale's payload one-for-one (SAD §3.5,
// types/aggregator.ts's RecordSalePayload) -- soldPrice/buyer details/
// delivery address+mode -- with deliveryAddress's four sub-fields flattened
// for the form and re-nested on submit.
export function RecordSaleDialog({ holding, open, onOpenChange }: RecordSaleDialogProps) {
  const recordSaleMutation = useRecordSaleMutation();

  const {
    control,
    handleSubmit,
    reset,
  } = useForm<RecordSaleFormValues>({
    resolver: zodResolver(recordSaleSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) reset(EMPTY_VALUES);
  }, [open, reset]);

  if (!holding) return null;

  function onSubmit(values: RecordSaleFormValues) {
    if (!holding) return;
    recordSaleMutation.mutate(
      {
        artworkId: holding.artworkId,
        soldPrice: values.soldPrice,
        buyerName: values.buyerName,
        buyerEmail: values.buyerEmail,
        buyerPhone: values.buyerPhone,
        deliveryAddress: {
          line1: values.line1,
          city: values.city,
          state: values.state,
          pincode: values.pincode,
        },
        deliveryMode: values.deliveryMode,
      },
      {
        onSuccess: () => {
          toast.success("Sale recorded", {
            description: `"${holding.artwork.title}" is now pending settlement.`,
          });
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!recordSaleMutation.isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record sale</DialogTitle>
          <DialogDescription>
            &ldquo;{holding.artwork.title}&rdquo; &mdash; matches the buyer
            and delivery details used to confirm this sale.
          </DialogDescription>
        </DialogHeader>

        <form
          id="record-sale-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          <FieldGroup className="gap-4">
            <Controller
              control={control}
              name="soldPrice"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="soldPrice">Sold price (₹)</FieldLabel>
                  <Input
                    id="soldPrice"
                    type="number"
                    min={1}
                    className="h-10"
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="buyerName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="buyerName">Buyer name</FieldLabel>
                    <Input id="buyerName" className="h-10" {...field} aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="buyerPhone"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="buyerPhone">Buyer phone</FieldLabel>
                    <Input id="buyerPhone" className="h-10" {...field} aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <Controller
              control={control}
              name="buyerEmail"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="buyerEmail">Buyer email</FieldLabel>
                  <Input
                    id="buyerEmail"
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
              name="line1"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="line1">Delivery address</FieldLabel>
                  <Input id="line1" className="h-10" {...field} aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                control={control}
                name="city"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="city">City</FieldLabel>
                    <Input id="city" className="h-10" {...field} aria-invalid={fieldState.invalid} />
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
                    <Input id="state" className="h-10" {...field} aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="pincode"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
                    <Input id="pincode" inputMode="numeric" maxLength={6} className="h-10" {...field} aria-invalid={fieldState.invalid} />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <Controller
              control={control}
              name="deliveryMode"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="deliveryMode">Delivery mode</FieldLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger id="deliveryMode" className="h-10 w-full">
                      <SelectValue placeholder="Select delivery mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="courier">Courier</SelectItem>
                      <SelectItem value="self_pickup">Self pickup</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={recordSaleMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" form="record-sale-form" disabled={recordSaleMutation.isPending}>
            {recordSaleMutation.isPending ? "Recording…" : "Record sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
