"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PackageSearch,
  Heart,
  MapPin,
  Settings,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SwitchMode } from "@/components/switch-mode";
import { NotificationsPopover } from "@/components/notifications-popover";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { mockCustomer, initials } from "./account-data";

// A third independent copy-and-adapt of the DashboardShell/AggregatorShell
// structural pattern (same reasoning as AggregatorShell's own header
// comment: two unrelated, fixed nav structures don't warrant a shared
// RoleShell abstraction). Adapted for the customer account section: no
// "create new X" CTA (nothing here gets created from the shell), and a
// profile card sourced from useCustomerProfile with the raw mockCustomer
// import as the pre-hydration fallback (the "start with known-good sync
// data, let the query refine it" pattern also used by the Overview pages).
const NAV_ITEMS = [
  { label: "Orders", href: "/account/orders", icon: PackageSearch },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Addresses", href: "/account/addresses", icon: MapPin },
  { label: "Settings", href: "/account/settings", icon: Settings },
] as const;

export function AccountShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { data: profile } = useCustomerProfile();
  const customer = profile ?? mockCustomer;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-background backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[transform,width] lg:sticky lg:top-0 lg:h-[100dvh] lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-20" : "lg:w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold italic text-gold-bright">
              GZ
            </span>
            <span
              className={cn(
                "text-xs font-medium tracking-[0.18em] text-sidebar-foreground",
                collapsed && "lg:hidden",
              )}
            >
              GALLERYZONE
            </span>
          </Link>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground lg:hidden"
          >
            <X className="size-5" />
          </button>
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
            className="hidden rounded-md p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground lg:inline-flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        <span
          className={cn(
            "mx-5 mt-1 mb-3 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase",
            collapsed && "lg:hidden",
          )}
        >
          My Account
        </span>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  collapsed && "lg:justify-center lg:px-2",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    active && "text-gold-bright",
                  )}
                  strokeWidth={1.75}
                />
                <span className={cn(collapsed && "lg:hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/account/settings"
          onClick={onClose}
          className={cn(
            "mx-3 mb-4 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 transition-colors hover:bg-sidebar-accent",
            collapsed && "lg:justify-center lg:px-2",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-xs font-semibold text-gold-bright">
            {initials(customer.name)}
          </span>
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {customer.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {customer.email}
            </p>
          </div>
        </Link>
      </aside>
    </>
  );
}

const PAGE_TITLES: Record<string, string> = {
  "/account/orders": "Orders",
  "/account/wishlist": "Wishlist",
  "/account/addresses": "Addresses",
  "/account/settings": "Settings",
};

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/account/orders/") ? "Order details" : "Account");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-md sm:px-8 lg:px-10">
      <div className="flex items-center gap-3">
        <button
          aria-label="Open menu"
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-foreground/80 hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" />
        </button>
        <h1 className="font-display text-lg font-semibold text-foreground">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsPopover />
        <SwitchMode width={44} height={24} />
        <SignOutButton />
      </div>
    </header>
  );
}
