"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { formatINR } from "@/lib/utils";
import { aggregatorService } from "@/services/aggregatorService";
import type { AggregatorHolding } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";

interface EditDisplayPriceDialogProps {
  holding: (AggregatorHolding & { artwork: ArtworkSummary }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Editing a holding's display price doesn't warrant a full useMutation --
// there's no async round trip to simulate and nothing else depends on its
// pending/error state (per Task 24's plan note). aggregatorService's
// synchronous updateDisplayPrice() is the single source of truth so the
// next unrelated ["aggregator-collection"] refetch can't silently revert
// it (see that method's own comment), and queryClient.setQueryData mirrors
// the change into the cache immediately for the table to reflect it without
// a refetch round trip.
export function EditDisplayPriceDialog({
  holding,
  open,
  onOpenChange,
}: EditDisplayPriceDialogProps) {
  const queryClient = useQueryClient();
  const floor = holding?.artwork.customerPrice ?? 0;

  const schema = useMemo(
    () =>
      z.object({
        displayPrice: z
          .number({ message: "Enter a price" })
          .min(floor, `Cannot be lower than the floor of ${formatINR(floor)}`),
      }),
    [floor],
  );

  const { control, handleSubmit, reset } = useForm<{ displayPrice: number }>({
    resolver: zodResolver(schema),
    defaultValues: { displayPrice: holding?.displayPrice ?? 0 },
  });

  useEffect(() => {
    if (holding) reset({ displayPrice: holding.displayPrice });
  }, [holding, reset]);

  if (!holding) return null;

  function onSubmit(values: { displayPrice: number }) {
    if (!holding) return;
    // The service refuses a second change (MOU §6) by throwing — surface that
    // rather than letting it break the dialog.
    let updated;
    try {
      updated = aggregatorService.updateDisplayPrice(
        holding.id,
        values.displayPrice,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not set the price",
      );
      onOpenChange(false);
      return;
    }

    queryClient.setQueryData<
      Array<AggregatorHolding & { artwork: ArtworkSummary }>
    >(["aggregator-collection"], (prev) =>
      prev?.map((h) =>
        h.id === holding.id
          ? {
              ...h,
              displayPrice: updated.displayPrice,
              displayPriceSetAt: updated.displayPriceSetAt,
            }
          : h,
      ),
    );
    toast.success("Selling price set");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set the selling price</DialogTitle>
          <DialogDescription>
            &ldquo;{holding.artwork.title}&rdquo; &mdash; you may set this above
            the marketplace price, never below it. This price is final and
            GST-inclusive: it&rsquo;s the exact amount the customer pays,
            don&rsquo;t add GST on top of it. Under your MOU (§6) you get one
            opportunity to set it, so it is fixed once you confirm.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          id="edit-display-price-form"
        >
          <Controller
            control={control}
            name="displayPrice"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="displayPrice">
                  Display price (₹, GST included)
                </FieldLabel>
                <Input
                  id="displayPrice"
                  type="number"
                  min={floor}
                  step={1}
                  className="h-10"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                />
                <FieldDescription>
                  Floor: {formatINR(floor)} (marketplace price, GST already
                  included)
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-display-price-form">
            Set price — final
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
