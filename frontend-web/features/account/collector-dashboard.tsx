"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBag,
  Frame,
  Heart,
  Wallet,
  Compass,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceTag } from "@/components/shared/price-tag";
import { useOrders } from "@/hooks/useOrders";
import { useCollection } from "@/hooks/useCollection";
import { useCustomerWallet } from "@/hooks/useCustomerWallet";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { useWishlistStore } from "@/store/useWishlistStore";
import { getArtworkById } from "@/lib/mock-data/helpers";
import { mockCustomer } from "./account-data";

export function CollectorDashboard() {
  const { data: profile } = useCustomerProfile();
  const { data: orders, isPending: ordersPending } = useOrders();
  const { data: collection } = useCollection();
  const { data: wallet } = useCustomerWallet();
  const wishlistCount = useWishlistStore((s) => s.ids.length);

  const customer = profile ?? mockCustomer;
  const recentOrders = [...(orders ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const stats = [
    {
      key: "orders",
      label: "Orders placed",
      value: orders?.length ?? 0,
      icon: ShoppingBag,
    },
    {
      key: "collection",
      label: "Artworks owned",
      value: collection?.length ?? 0,
      icon: Frame,
    },
    {
      key: "wishlist",
      label: "Wishlist",
      value: wishlistCount,
      icon: Heart,
    },
    {
      key: "wallet",
      label: "Store credit",
      value: `₹${(wallet?.balance ?? 0).toLocaleString("en-IN")}`,
      icon: Wallet,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Welcome back, {customer.name.split(" ")[0]}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&rsquo;s a snapshot of your GalleryZone activity.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <stat.icon className="size-4 text-gold-bright" strokeWidth={1.75} />
            </div>
            <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-foreground">
              {stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      <Link
        href="/marketplace"
        className="group flex items-center justify-between gap-4 rounded-lg border border-gold/30 bg-gold/5 p-5 transition-colors hover:border-gold/50"
      >
        <div className="flex items-center gap-3">
          <Compass className="size-5 text-gold-bright" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Discover more artworks
            </p>
            <p className="text-xs text-muted-foreground">
              Browse original work from independent artists across India.
            </p>
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-gold-bright transition-transform group-hover:translate-x-0.5" />
      </Link>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-foreground">
            Recent orders
          </h3>
          <Link
            href="/account/orders"
            className="text-xs font-medium text-gold-bright hover:underline"
          >
            View all
          </Link>
        </div>

        {ordersPending ? (
          <div className="mt-3 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No orders yet — your purchases will show up here.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {recentOrders.map((order) => {
              const artwork = getArtworkById(order.artworkId);
              return (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-gold/50"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {artwork && (
                      <Image
                        src={artwork.thumbnailUrl}
                        alt={artwork.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {artwork?.title ?? "Artwork no longer available"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {order.status}
                    </p>
                  </div>
                  <PriceTag
                    amount={order.amount + order.gstAmount + order.deliveryCharge}
                    className="text-sm"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
