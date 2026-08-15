"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  PackageSearch,
  GalleryVerticalEnd,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SwitchMode } from "@/components/switch-mode";
import { NotificationsPopover } from "@/components/notifications-popover";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { AGGREGATOR } from "./aggregator-data";

// Deliberately a parallel sibling to features/dashboard/dashboard-shell.tsx,
// not a shared/generalized abstraction over it — DashboardShell is
// hardcoded to artist nav items and artist-specific data (NAV_ITEMS is a
// local const there too, not a prop), so generalizing it into a shared
// RoleShell for two call sites is more abstraction than two fixed,
// unrelated nav structures warrant, and risks regressing the already-
// shipped, working Artist Dashboard. This file copies that shell's
// structure and exact Tailwind classes/tokens for visual consistency, then
// adapts: aggregator nav items, no "List new artwork" CTA (aggregators
// don't create listings), and a non-interactive profile card (no
// verification page exists for aggregators in this phase).
const NAV_ITEMS = [
  { label: "Dashboard", href: "/aggregator/dashboard", icon: LayoutGrid },
  { label: "Inventory", href: "/aggregator/inventory", icon: PackageSearch },
  {
    label: "Collection",
    href: "/aggregator/collection",
    icon: GalleryVerticalEnd,
  },
] as const;

export function AggregatorShell({ children }: { children: React.ReactNode }) {
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
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
          Aggregator Portal
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

        {/* Static "signed in as" card, mirroring DashboardShell's bottom
            profile card visually. Not a Link: aggregators have no
            verification/settings page to navigate to in this phase, so
            unlike the artist shell's equivalent card, this one is purely
            informational. */}
        <div
          className={cn(
            "mx-3 mb-4 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3",
            collapsed && "lg:justify-center lg:px-2",
          )}
        >
          <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-gold/40">
            <Image
              src={AGGREGATOR.avatar}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {AGGREGATOR.companyName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {AGGREGATOR.contactPerson}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

const PAGE_TITLES: Record<string, string> = {
  "/aggregator/dashboard": "Dashboard",
  "/aggregator/inventory": "Inventory",
  "/aggregator/collection": "Collection",
};

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Aggregator Portal";

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
