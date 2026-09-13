"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutGrid,
  ShoppingBag,
  GalleryVerticalEnd,
  MoreHorizontal,
  CircleUserRound,
  PackageSearch,
  Users,
  Building2,
  Truck,
  Wallet,
  Landmark,
  LineChart,
  MessageSquare,
  LifeBuoy,
  Settings as SettingsIcon,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AGGREGATOR } from "@/features/aggregator/aggregator-data";
import { authService } from "@/services/authService";
import { useAggregatorMessages } from "@/hooks/useAggregatorMessages";

const PRIMARY_TABS = [
  { href: "/aggregator/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/aggregator/orders", label: "Orders", icon: ShoppingBag },
  { href: "/aggregator/inventory", label: "Discover", icon: GalleryVerticalEnd },
  { href: "/aggregator/collection", label: "Collection", icon: PackageSearch },
];

const MORE_SECTIONS = [
  {
    label: "Main",
    items: [
      { label: "My Profile", href: "/aggregator/profile", icon: CircleUserRound },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Customers", href: "/aggregator/customers", icon: Users },
      { label: "Display Spaces", href: "/aggregator/gallery-spaces", icon: Building2 },
      { label: "Shipping & Logistics", href: "/aggregator/shipping", icon: Truck },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Earnings & Wallet", href: "/aggregator/wallet", icon: Wallet },
      { label: "Settlements", href: "/aggregator/settlements", icon: Landmark },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Analytics", href: "/aggregator/analytics", icon: LineChart },
      { label: "Messages", href: "/aggregator/messages", icon: MessageSquare },
    ],
  },
  {
    label: "Support & Account",
    items: [
      { label: "Support", href: "/aggregator/support", icon: LifeBuoy },
      { label: "Settings", href: "/aggregator/settings", icon: SettingsIcon },
    ],
  },
];

function tabActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

function isMoreActive(pathname: string) {
  return !PRIMARY_TABS.some((t) => pathname.startsWith(t.href));
}

export function AggregatorMobileBottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: messages } = useAggregatorMessages();
  const unreadMessages = messages?.filter((m) => m.unread).length ?? 0;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setMoreOpen(false); }, [pathname]);

  if (!mounted) return null;

  const moreHighlighted = moreOpen || isMoreActive(pathname);

  return (
    <>
      <nav
        aria-label="Aggregator bottom navigation"
        className="fixed bottom-0 inset-x-0 z-50 flex h-16 items-stretch border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      >
        {PRIMARY_TABS.map((tab) => {
          const active = tabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium transition-colors",
                active ? "text-gold-bright" : "text-muted-foreground",
              )}
            >
              <tab.icon className={cn("size-5", active && "text-gold-bright")} strokeWidth={active ? 2 : 1.75} />
              <span>{tab.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium transition-colors",
            moreHighlighted ? "text-gold-bright" : "text-muted-foreground",
          )}
        >
          <span className="relative">
            <MoreHorizontal className={cn("size-5", moreHighlighted && "text-gold-bright")} strokeWidth={moreHighlighted ? 2 : 1.75} />
            {unreadMessages > 0 && (
              <span className="absolute -top-1 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-gold-bright text-[8px] font-bold text-[#171310]">
                {unreadMessages}
              </span>
            )}
          </span>
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-50 flex flex-col rounded-t-2xl border-t border-border bg-sidebar transition-transform duration-300 ease-in-out lg:hidden",
          moreOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ maxHeight: "88dvh" }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative size-10 overflow-hidden rounded-full border border-gold/40">
              <Image src={AGGREGATOR.avatar} alt={AGGREGATOR.companyName} fill sizes="40px" className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground leading-tight">{AGGREGATOR.companyName}</p>
              <p className="text-[11px] text-muted-foreground">Aggregator</p>
            </div>
          </div>
          <button
            onClick={() => setMoreOpen(false)}
            className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="h-px bg-border mx-5" />

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 space-y-4">
          {MORE_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                {section.label}
              </p>
              <nav className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = tabActive(pathname, item.href);
                  const msgBadge = item.href === "/aggregator/messages" && unreadMessages > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                        active ? "bg-gold/15 text-gold-bright" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                      )}
                    >
                      <item.icon
                        className={cn("size-[18px] shrink-0", active ? "text-gold-bright" : "text-muted-foreground")}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1">{item.label}</span>
                      {msgBadge && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-gold-bright text-[10px] font-bold text-[#171310]">
                          {unreadMessages}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => { void authService.logout(); window.location.href = "/login"; }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-[18px] shrink-0" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
