"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { AddressCard } from "@/features/account/address-card";
import { AddressFormDialog } from "@/features/account/address-form-dialog";
import { useAddresses, useDeleteAddressMutation } from "@/hooks/useAddresses";
import type { Address } from "@/types/customer";

export default function AccountAddressesPage() {
  const { data, isPending, isError } = useAddresses();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteAddressMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingAddress(undefined);
    setDialogOpen(true);
  }

  function openEdit(address: Address) {
    setEditingAddress(address);
    setDialogOpen(true);
  }

  // Deleting an address is a client-side-only rule for this mock phase, not
  // a real backend constraint (there's no backend to enforce one): the
  // returned {id} is used to filter the cache directly (same reasoning as
  // AddressFormDialog -- customerService.deleteAddress doesn't mutate the
  // shared fixture, so the visible removal has to happen here). If the
  // removed address was the default and another address remains, the next
  // one in the list becomes the new default so the account never ends up
  // with zero default addresses while any address exists.
  function handleDelete(address: Address) {
    setDeletingId(address.id);
    deleteMutation.mutate(address.id, {
      onSuccess: () => {
        queryClient.setQueryData<Address[]>(["addresses"], (prev) => {
          const remaining = (prev ?? []).filter((a) => a.id !== address.id);
          if (address.isDefault && remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
            remaining[0] = { ...remaining[0]!, isDefault: true };
          }
          return remaining;
        });
        toast.success("Address removed");
      },
      onError: (error) => toast.error(error.message),
      onSettled: () => setDeletingId(null),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Saved addresses
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the delivery addresses on your account.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" strokeWidth={2} />
          Add address
        </Button>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={MapPin}
          title="Couldn't load your addresses"
          description="Something went wrong loading your saved addresses. Try refreshing the page."
        />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a delivery address to speed up checkout next time."
          action={<Button onClick={openCreate}>Add address</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => openEdit(address)}
              onDelete={() => handleDelete(address)}
              isDeleting={deletingId === address.id}
            />
          ))}
        </div>
      )}

      <AddressFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialValues={editingAddress}
      />
    </div>
  );
}
