"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CircleUserRound,
  Image as ImageIcon,
  Wallet,
  ShieldCheck,
  Plus,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SwitchMode } from "@/components/switch-mode";
import { NotificationsPopover } from "@/components/notifications-popover";
import { ARTIST } from "./dashboard-data";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutGrid },
  { label: "Profile & KYC", href: "/dashboard/profile", icon: CircleUserRound },
  { label: "My artworks", href: "/dashboard/artworks", icon: ImageIcon },
  { label: "Wallet", href: "/dashboard/wallet", icon: Wallet },
  { label: "Verification", href: "/dashboard/verification", icon: ShieldCheck },
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
          collapsed ? "lg:w-20" : "lg:w-64"
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
                collapsed && "lg:hidden"
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

        <Link
          href="/dashboard/artworks/upload"
          title={collapsed ? "List new artwork" : undefined}
          className={cn(
            "mx-4 mb-2 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-bright/95 px-4 py-2.5 text-sm font-semibold text-[#171310] transition-colors hover:bg-gold-bright",
            collapsed && "lg:mx-3 lg:px-0"
          )}
        >
          <Plus className="size-4 shrink-0" />
          <span className={cn(collapsed && "lg:hidden")}>List new artwork</span>
        </Link>

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
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <item.icon
                  className={cn("size-4 shrink-0", active && "text-gold-bright")}
                  strokeWidth={1.75}
                />
                <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/dashboard/verification"
          className={cn(
            "mx-3 mb-4 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-3 transition-colors hover:bg-sidebar-accent",
            collapsed && "lg:justify-center lg:px-2"
          )}
        >
          <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-gold/40">
            <Image src={ARTIST.avatar} alt="" fill sizes="36px" className="object-cover" />
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
  "/dashboard": "Overview",
  "/dashboard/profile": "Profile & KYC",
  "/dashboard/artworks": "My Artworks",
  "/dashboard/artworks/upload": "Submit Artwork",
  "/dashboard/wallet": "Wallet",
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
      </div>
    </header>
  );
}
