import {
  FileEdit,
  Clock3,
  Sparkles,
  BookmarkCheck,
  CircleCheckBig,
  CircleX,
  Ban,
  Truck,
  PackageCheck,
  Scale,
  UserCheck,
  ShieldQuestion,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtworkStatus } from "@/types/artwork";
import type { OrderStatus } from "@/types/order";
import type {
  KycStatus,
  SettlementStatus,
  UserStatus,
  WithdrawalStatus,
} from "@/types/admin";

// Every status string the admin console can render, from five different
// domains. Some values overlap between domains ("pending" belongs to orders,
// users, withdrawals, settlements and KYC; "delivered" to both artworks and
// orders; "completed" to both artworks and withdrawals) -- deliberately one
// shared map, because those overlaps genuinely mean the same thing to a
// reader and splitting them would produce two different pills for one word.
export type AdminStatus =
  | ArtworkStatus
  | OrderStatus
  | UserStatus
  | WithdrawalStatus
  | SettlementStatus
  | KycStatus;

// Four tones from the plan (positive / pending / negative / neutral) plus
// "info" for in-flight states, because features/dashboard/artwork-status-pill.tsx
// -- the convention this component is explicitly following rather than
// replacing -- already renders `reserved` in sky. Dropping it would invent a
// second status language instead of extending the existing one.
type Tone = "positive" | "pending" | "negative" | "neutral" | "info";

// Text colors are split light/dark: the existing pill's bare `text-emerald-400`
// reads too pale on the light theme's paper background. Dark theme (the
// product's default and what the original pill was designed against) is
// pixel-identical; light theme just gets a readable weight.
const TONE_CLASSES: Record<Tone, string> = {
  positive:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  pending: "border-gold/35 bg-gold/10 text-gold-bright",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-secondary text-muted-foreground",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const STATUS_CONFIG: Record<
  AdminStatus,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  // --- artwork lifecycle ---
  draft: { label: "Draft", tone: "neutral", icon: FileEdit },
  pending_approval: {
    label: "Pending Approval",
    tone: "pending",
    icon: Clock3,
  },
  marketplace: { label: "Marketplace", tone: "positive", icon: Sparkles },
  reserved: { label: "Reserved", tone: "info", icon: BookmarkCheck },
  preparing_dispatch: {
    label: "Preparing Dispatch",
    tone: "info",
    icon: PackageCheck,
  },
  in_transit: { label: "In Transit", tone: "info", icon: Truck },
  with_aggregator: {
    label: "With Aggregator",
    tone: "info",
    icon: BookmarkCheck,
  },
  sold: { label: "Sold", tone: "positive", icon: CircleCheckBig },
  settlement_complete: { label: "Settled", tone: "positive", icon: Scale },
  sold_externally: {
    label: "Sold Elsewhere",
    tone: "neutral",
    icon: CircleX,
  },
  returned: { label: "Returned", tone: "negative", icon: Undo2 },

  // --- orders (delivered / completed / pending shared with the above) ---
  paid: { label: "Paid", tone: "positive", icon: Wallet },
  confirmed: { label: "Confirmed", tone: "info", icon: CircleCheckBig },
  packed: { label: "Packed", tone: "info", icon: PackageCheck },
  transit: { label: "In Transit", tone: "info", icon: Truck },
  delivered: { label: "Delivered", tone: "positive", icon: PackageCheck },
  completed: { label: "Completed", tone: "positive", icon: CircleCheckBig },
  cancelled: { label: "Cancelled", tone: "negative", icon: CircleX },

  // --- shared across users / withdrawals / settlements / KYC ---
  pending: { label: "Pending", tone: "pending", icon: Clock3 },

  // --- users ---
  active: { label: "Active", tone: "positive", icon: CircleCheckBig },
  suspended: { label: "Suspended", tone: "negative", icon: Ban },
  blocked: { label: "Blocked", tone: "negative", icon: Ban },

  // --- withdrawals / settlements ---
  rejected: { label: "Rejected", tone: "negative", icon: CircleX },
  failed: { label: "Failed", tone: "negative", icon: CircleX },
  processed: { label: "Processed", tone: "positive", icon: CircleCheckBig },

  // --- KYC ---
  submitted: { label: "Submitted", tone: "pending", icon: ShieldQuestion },
  under_review: {
    label: "Under Review",
    tone: "pending",
    icon: ShieldQuestion,
  },
  approved: { label: "Approved", tone: "positive", icon: UserCheck },
};

// Exported so filter dropdowns and detail pages label a status exactly the way
// its badge does, instead of each call site writing its own prettified string.
export function adminStatusLabel(status: AdminStatus): string {
  return STATUS_CONFIG[status]?.label ?? status;
}

interface AdminStatusBadgeProps {
  status: AdminStatus;
  /** "sm" is the table-density variant; "default" matches ArtworkStatusPill. */
  size?: "sm" | "default";
  className?: string;
}

export function AdminStatusBadge({
  status,
  size = "default",
  className,
}: AdminStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // Defensive: an unmapped status renders as a neutral pill with the raw value
  // rather than crashing the whole table on one bad row.
  const tone = config?.tone ?? "neutral";
  const Icon = config?.icon ?? Clock3;
  const label = config?.label ?? status;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border font-medium whitespace-nowrap",
        size === "sm"
          ? "gap-1 px-2 py-0.5 text-[11px]"
          : "gap-1.5 px-2.5 py-1 text-xs",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={2} />
      {label}
    </span>
  );
}
