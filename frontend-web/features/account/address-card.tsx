import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Address } from "@/types/customer";

interface AddressCardProps {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function AddressCard({
  address,
  onEdit,
  onDelete,
  isDeleting,
}: AddressCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
          <MapPin className="size-4 text-muted-foreground" strokeWidth={1.75} />
        </span>
        {address.isDefault && (
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold-bright">
            Default
          </span>
        )}
      </div>

      <div className="text-sm leading-relaxed text-muted-foreground">
        <p className="text-foreground">{address.line1}</p>
        {address.line2 && <p>{address.line2}</p>}
        <p>
          {address.city}, {address.state} {address.pincode}
        </p>
      </div>

      <div className="mt-1 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" strokeWidth={1.75} />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          {isDeleting ? "Removing…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}
