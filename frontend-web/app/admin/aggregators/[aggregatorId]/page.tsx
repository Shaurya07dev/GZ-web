import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserDetailHeader } from "@/features/admin/people/user-detail-header";
import { AdminStatusBadge } from "@/features/admin/admin-status-badge";
import { mockAdminUsers, defaultPlatformSettings } from "@/lib/mock-data/admin";
import { mockAggregatorHoldings } from "@/lib/mock-data/aggregator-holdings";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { ADMIN_TODAY } from "@/features/admin/admin-data";
import { formatINR } from "@/lib/utils";

export default async function AdminAggregatorDetailPage(
  props: PageProps<"/admin/aggregators/[aggregatorId]">,
) {
  const { aggregatorId } = await props.params;
  const user = mockAdminUsers.find(
    (u) => u.id === aggregatorId && u.role === "aggregator",
  );
  if (!user) notFound();

  // One aggregator fixture set exists platform-wide in this mock build, so
  // holdings are shown for the console's demo aggregator rather than being
  // partitioned per row.
  const holdings = mockAggregatorHoldings;
  const sold = holdings.filter((h) => h.status === "sold_pending_settlement");
  const commissionEarned = sold.reduce((sum, holding) => {
    const artwork = getArtworkById(holding.artworkId);
    if (!artwork) return sum;
    const markup = holding.displayPrice - artwork.customerPrice;
    return (
      sum +
      Math.max(0, markup) *
        (defaultPlatformSettings.aggregatorCommissionPercent / 100)
    );
  }, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.companyName ?? user.name}
        description="Aggregator record, current consignments, and commission."
        backHref="/admin/aggregators"
        backLabel="Back to aggregators"
      />

      <UserDetailHeader user={user} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Active holdings"
          value={String(holdings.filter((h) => h.status === "reserved").length)}
        />
        <Stat label="Sales closed" value={String(sold.length)} />
        <Stat
          label="Commission earned"
          value={formatINR(Math.round(commissionEarned))}
        />
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">
            Consignments
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Works currently held, and their 30-day display windows.
          </p>
        </div>

        {holdings.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No works on consignment.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {holdings.map((holding) => {
              const artwork = getArtworkById(holding.artworkId);
              const daysLeft = Math.max(
                0,
                Math.round(
                  (new Date(holding.expiresAt).getTime() -
                    ADMIN_TODAY.getTime()) /
                    86_400_000,
                ),
              );
              return (
                <li key={holding.id}>
                  <Link
                    href={`/admin/artworks/${holding.artworkId}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {artwork?.title ?? holding.artworkId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {holding.advancePercent}% advance ·{" "}
                        {formatINR(holding.advanceAmount)} paid
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-foreground">
                      {formatINR(holding.displayPrice)}
                    </span>
                    <span
                      className={`text-xs tabular-nums ${daysLeft <= 3 ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {holding.status === "sold_pending_settlement"
                        ? "Sold"
                        : `${daysLeft}d left`}
                    </span>
                    {artwork ? (
                      <AdminStatusBadge status={artwork.status} size="sm" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
