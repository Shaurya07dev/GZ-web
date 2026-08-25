"use client";

import { Frame, Heart, ShoppingBag, Truck, Wallet, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/utils";
import { useCollectorStats } from "@/hooks/useProfileStats";
import { useWishlistStore } from "@/store/useWishlistStore";

// Who this collector is, in figures. Sits at the top of their account so the
// first thing they see is what they own rather than a list of settings.
//
// Everything here is derived on read (services/profileStatsService.ts), so a
// number cannot disagree with the page it links to.

function joinedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export function CollectorProfileCard({ name }: { name: string }) {
  const { data: stats, isPending } = useCollectorStats();
  // The wishlist is a client-only store, so it is read here rather than in the
  // service, which has no access to it.
  const wishlisted = useWishlistStore((s) => s.ids.length);

  if (isPending || !stats) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  const cells = [
    { key: "owned", label: "Works owned", value: String(stats.worksOwned), icon: Frame },
    { key: "orders", label: "Orders placed", value: String(stats.ordersPlaced), icon: ShoppingBag },
    { key: "transit", label: "On the way", value: String(stats.inProgress), icon: Truck },
    { key: "spent", label: "Total spent", value: formatINR(stats.totalSpent), icon: Wallet },
    { key: "wishlist", label: "Wishlisted", value: String(wishlisted), icon: Heart },
    { key: "resale", label: "Listed for resale", value: String(stats.listedForResale), icon: Tag },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Collecting since {joinedLabel(stats.joinedAt)}
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((cell) => (
          <div key={cell.key} className="flex flex-col gap-1">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <cell.icon className="size-3.5" strokeWidth={1.75} />
              {cell.label}
            </dt>
            <dd className="font-display text-xl font-semibold tabular-nums text-foreground">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* One purchase is a purchase; two from the same artist is a taste, and
          worth telling someone about their own collection. */}
      {stats.artistsCollected.length > 0 && (
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          You collect{" "}
          <span className="text-foreground">
            {stats.artistsCollected.slice(0, 3).join(", ")}
          </span>{" "}
          more than once.
        </p>
      )}
    </section>
  );
}
