"use client";

import { UserAvatar } from "@/components/shared/user-avatar";

import { useCurrentUser } from "@/hooks/useCurrentUser";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CircleUserRound,
  Image as ImageIcon,
  ImagePlus,
  LayoutTemplate,
  ShoppingBag,
  Wallet,
  Landmark,
  Fingerprint,
  LineChart,
  MessageSquare,
  Building2,
  LifeBuoy,
  Settings as SettingsIcon,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SwitchMode } from "@/components/switch-mode";
import { NotificationsPopover } from "@/components/notifications-popover";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { SidebarBrand } from "@/components/shared/sidebar-brand";
import { useArtistMessages } from "@/hooks/useArtistMessages";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "My Profile", href: "/dashboard/profile", icon: CircleUserRound },
  { label: "My Artworks", href: "/dashboard/artworks", icon: ImageIcon },
  { label: "Add Artwork", href: "/dashboard/artworks/upload", icon: ImagePlus },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: LayoutTemplate },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
  { label: "Earnings & Wallet", href: "/dashboard/wallet", icon: Wallet },
  { label: "Settlements", href: "/dashboard/settlements", icon: Landmark },
  { label: "COA & NFC", href: "/dashboard/coa-nfc", icon: Fingerprint },
  { label: "Analytics", href: "/dashboard/analytics", icon: LineChart },
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  {
    label: "Aggregator Display",
    href: "/dashboard/gallery-spaces",
    icon: Building2,
  },
  { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
  { label: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="relative flex-1 overflow-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop: static, collapsible sidebar — lg-only now. Mobile gets its
          own Dialog-based drawer below instead of this same element
          repositioned with translate-x, so the drawer a11y fix can't touch
          desktop's collapse behavior. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] lg:sticky lg:top-0 lg:z-50 lg:flex lg:h-[100dvh]",
          collapsed ? "lg:w-20" : "lg:w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <SidebarBrand collapsed={collapsed} />
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
            className="rounded-md p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>
        <SidebarBody collapsed={collapsed} onNavigate={() => {}} showGroups={false} />
      </aside>

      {/* Mobile: a real Dialog instead of the old backdrop-button + translate
          hack — base-ui gives focus trap, ESC-to-close and scroll lock for
          free, the same primitive components/site-header.tsx already uses
          for the public nav drawer, instead of hand-rolling those again. */}
      <Dialog open={mobileOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 flex h-full max-h-none w-64 max-w-[85vw] translate-x-0 translate-y-0 flex-col rounded-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground ring-0 lg:hidden"
        >
          <DialogTitle className="sr-only">Navigation menu</DialogTitle>
          <div className="flex h-16 shrink-0 items-center justify-between px-5">
            <SidebarBrand collapsed={false} />
            <DialogClose
              render={
                <button
                  aria-label="Close menu"
                  className="rounded-md p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                />
              }
            >
              <X className="size-5" />
            </DialogClose>
          </div>
          <SidebarBody collapsed={false} onNavigate={onClose} showGroups />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Purely a mobile presentation grouping — same items, same order as before,
// so desktop (showGroups=false) renders byte-identical to pre-redesign.
// Grouped as its own phase (not reordered into the "ideal" grouping) because
// reordering NAV_ITEMS would move desktop's list too; that's a desktop-phase
// decision, not this one.
const GROUP_LABEL_BEFORE: Partial<Record<string, string>> = {
  "/dashboard": "Overview",
  "/dashboard/artworks": "Artworks",
  "/dashboard/orders": "Sales",
  "/dashboard/coa-nfc": "Identity",
  "/dashboard/analytics": "Insights",
  "/dashboard/gallery-spaces": "More",
};

function SidebarBody({
  collapsed,
  onNavigate,
  showGroups,
}: {
  collapsed: boolean;
  onNavigate: () => void;
  showGroups: boolean;
}) {
  const { data: me } = useCurrentUser();
  const pathname = usePathname();
  const { data: messages } = useArtistMessages();
  const unreadMessages = messages?.filter((m) => m.unread).length ?? 0;

  return (
    <>
      {/* View site — pinned at the top so the artist can jump straight
          to the public marketplace from anywhere in the dashboard. */}
      <Link
        href="/marketplace"
        onClick={onNavigate}
        className={cn(
          "mx-3 mt-3 flex items-center gap-3 rounded-lg border border-sidebar-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
          collapsed && "lg:justify-center lg:px-2",
        )}
      >
        <Store className="size-4 shrink-0" strokeWidth={1.75} />
        <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>
          View site
        </span>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const groupLabel = showGroups
            ? GROUP_LABEL_BEFORE[item.href]
            : undefined;
          return (
            <div key={item.href} className="contents">
              {groupLabel && (
                <p className="mt-3 mb-1 px-3 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase first:mt-0">
                  {groupLabel}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
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
                <span
                  className={cn("flex-1 truncate", collapsed && "lg:hidden")}
                >
                  {item.label}
                </span>
                {item.label === "Messages" && unreadMessages > 0 && (
                  <span
                    className={cn(
                      "flex size-4.5 shrink-0 items-center justify-center rounded-full bg-gold-bright text-[10px] font-semibold text-[#171310]",
                      collapsed && "lg:hidden",
                    )}
                  >
                    {unreadMessages}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>


      <Link
        href="/dashboard/profile"
        onClick={onNavigate}
        className={cn(
          "mx-3 mb-4 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 transition-colors hover:bg-sidebar-accent",
          collapsed && "lg:justify-center lg:px-2",
        )}
      >
        <UserAvatar name={me?.name} className="size-9" />
        <div className={cn("min-w-0", collapsed && "lg:hidden")}>
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {me?.name ?? "Artist"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {me?.email ?? ""}
          </p>
        </div>
      </Link>
    </>
  );
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/profile": "My Profile",
  "/dashboard/artworks": "My Artworks",
  "/dashboard/artworks/upload": "Add Artwork",
  "/dashboard/portfolio": "Portfolio",
  "/dashboard/orders": "Orders",
  "/dashboard/wallet": "Earnings & Wallet",
  "/dashboard/settlements": "Settlements",
  "/dashboard/coa-nfc": "COA & NFC",
  "/dashboard/analytics": "Analytics",
  "/dashboard/messages": "Messages",
  "/dashboard/gallery-spaces": "Aggregator Display",
  "/dashboard/support": "Support",
  "/dashboard/settings": "Settings",
  "/dashboard/verification": "Verification",
};

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  // Dynamic segments can't be keys in PAGE_TITLES, so the one route with an id
  // in it is matched by shape.
  const title =
    PAGE_TITLES[pathname] ??
    (/^\/dashboard\/artworks\/[^/]+\/edit$/.test(pathname)
      ? "Edit Artwork"
      : "Dashboard");

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
        <SwitchMode />
        <SignOutButton />
      </div>
    </header>
  );
}
