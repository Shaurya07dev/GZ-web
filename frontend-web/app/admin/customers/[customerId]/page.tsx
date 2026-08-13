import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserDetailHeader } from "@/features/admin/people/user-detail-header";
import { AdminStatusBadge } from "@/features/admin/admin-status-badge";
import { mockAdminUsers } from "@/lib/mock-data/admin";
import { mockOrders, mockAddresses } from "@/lib/mock-data/customer";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { formatINR } from "@/lib/utils";

export default async function AdminCustomerDetailPage(
  props: PageProps<"/admin/customers/[customerId]">,
) {
  const { customerId } = await props.params;
  const user = mockAdminUsers.find((u) => u.id === customerId && u.role === "customer");
  if (!user) notFound();

  // One customer fixture set exists platform-wide in this mock build, so the
  // seeded order history is shown for the console's demo customer rather than
  // being partitioned per row.
  const orders = mockOrders;
  const lifetimeValue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.amount + o.gstAmount + o.deliveryCharge, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.name}
        description="Customer record and order history."
        backHref="/admin/customers"
        backLabel="Back to customers"
      />

      <UserDetailHeader user={user} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Lifetime value" value={formatINR(lifetimeValue)} />
        <Stat label="Saved addresses" value={String(mockAddresses.length)} />
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">
            Order history
          </h2>
        </div>

        {orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No orders yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.map((order) => {
              const artwork = getArtworkById(order.artworkId);
              const total = order.amount + order.gstAmount + order.deliveryCharge;
              return (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {artwork?.title ?? order.artworkId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <AdminStatusBadge status={order.status} size="sm" />
                    <span className="shrink-0 text-sm tabular-nums text-foreground">
                      {formatINR(total)}
                    </span>
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
