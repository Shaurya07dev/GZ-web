"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SwitchMode } from "@/components/switch-mode";
import { NotificationsPopover } from "@/components/notifications-popover";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { useArtistMessages } from "@/hooks/useArtistMessages";
import { ARTIST } from "./dashboard-data";

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
  { label: "Gallery Spaces", href: "/dashboard/gallery-spaces", icon: Building2 },
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
  const { data: messages } = useArtistMessages();
  const unreadMessages = messages?.filter((m) => m.unread).length ?? 0;

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

        <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
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
                <span
                  className={cn(
                    "flex-1 truncate",
                    collapsed && "lg:hidden",
                  )}
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
            );
          })}
        </nav>

        <Link
          href="/dashboard/profile"
          className={cn(
            "mx-3 mb-4 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 transition-colors hover:bg-sidebar-accent",
            collapsed && "lg:justify-center lg:px-2",
          )}
        >
          <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-gold/40">
            <Image
              src={ARTIST.avatar}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
          <div className={cn("min-w-0", collapsed && "lg:hidden")}>
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {ARTIST.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Tier {ARTIST.verifiedTier} of 3 verified
            </p>
          </div>
        </Link>
      </aside>
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
  "/dashboard/gallery-spaces": "Gallery Spaces",
  "/dashboard/support": "Support",
  "/dashboard/settings": "Settings",
  "/dashboard/verification": "Verification",
};

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Dashboard";

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
