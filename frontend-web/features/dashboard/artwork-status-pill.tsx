import {
  FileEdit,
  Clock3,
  Sparkles,
  BookmarkCheck,
  PackageCheck,
  Truck,
  Building2,
  CircleCheckBig,
  Landmark,
  PackageOpen,
  Undo2,
} from "lucide-react";
import type { ArtworkStatus } from "@/types/artwork";

const STATUS_CONFIG: Record<
  ArtworkStatus,
  { label: string; icon: typeof FileEdit; className: string }
> = {
  draft: {
    label: "Draft",
    icon: FileEdit,
    className: "border-border bg-secondary text-muted-foreground",
  },
  pending_approval: {
    label: "Pending Approval",
    icon: Clock3,
    className: "border-gold/35 bg-gold/10 text-gold-bright",
  },
  marketplace: {
    label: "Live",
    icon: Sparkles,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  reserved: {
    label: "Reserved",
    icon: BookmarkCheck,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  preparing_dispatch: {
    label: "Preparing Dispatch",
    icon: PackageOpen,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  in_transit: {
    label: "In Transit",
    icon: Truck,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  with_aggregator: {
    label: "With Gallery",
    icon: Building2,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  sold: {
    label: "Sold",
    icon: CircleCheckBig,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  settlement_complete: {
    label: "Settled",
    icon: Landmark,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  delivered: {
    label: "Delivered",
    icon: PackageCheck,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  completed: {
    label: "Completed",
    icon: CircleCheckBig,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  returned: {
    label: "Returned",
    icon: Undo2,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function ArtworkStatusPill({ status }: { status: ArtworkStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <Icon className="size-3" strokeWidth={2} />
      {config.label}
    </span>
  );
}
