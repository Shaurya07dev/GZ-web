"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Clock3,
  Wallet,
  CircleCheckBig,
  PackageCheck,
  Truck,
  CheckCheck,
  XCircle,
  PackageSearch,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PriceTag } from "@/components/shared/price-tag";
import { useOrders } from "@/hooks/useOrders";
import type { OrderStatus } from "@/types/order";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock3,
    className: "border-border bg-muted text-muted-foreground",
  },
  paid: {
    label: "Paid",
    icon: Wallet,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  confirmed: {
    label: "Confirmed",
    icon: CircleCheckBig,
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  packed: {
    label: "Packed",
    icon: PackageCheck,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  transit: {
    label: "In transit",
    icon: Truck,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCheck,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function OrderList() {
  const { data, isPending, isError } = useOrders();

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Couldn't load your orders"
        description="Something went wrong loading your order history. Try refreshing the page."
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No orders yet"
        description="Everything you buy on GalleryZone will show up here, with full status tracking."
        action={
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-md border border-gold/60 px-4 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
          >
            Browse the marketplace
          </Link>
        }
      />
    );
  }

  const sorted = [...data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((order) => {
        const artwork = order.artwork;
        const total = order.amount + order.gstAmount + order.deliveryCharge;
        const status = STATUS_CONFIG[order.status];

        return (
          <Link
            key={order.id}
            href={`/account/orders/${order.id}`}
            className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {artwork && (
                <Image
                  src={artwork.thumbnailUrl}
                  alt={artwork.title}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-foreground">
                {artwork?.title ?? "Artwork no longer available"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {artwork?.artistName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Placed {formatDate(order.createdAt)}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                  status.className,
                )}
              >
                <status.icon className="size-3" strokeWidth={2} />
                {status.label}
              </span>
              <PriceTag amount={total} className="text-sm" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
