"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Compass,
  Heart,
  Frame,
  ShoppingBag,
  Wallet,
  Repeat2,
  CircleUserRound,
  MapPin,
  LifeBuoy,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarBrand } from "@/components/shared/sidebar-brand";
import { SwitchMode } from "@/components/switch-mode";
import { NotificationsPopover } from "@/components/notifications-popover";
import { SignOutButton } from "@/components/shared/sign-out-button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { useCustomerProfile } from "@/hooks/useCustomerProfile";
import { mockCustomer, initials } from "./account-data";

// A third independent copy-and-adapt of the DashboardShell/AggregatorShell
// structural pattern (same reasoning as AggregatorShell's own header
// comment: unrelated, fixed nav structures don't warrant a shared RoleShell
// abstraction). Grouped/collapsible nav mirrors AggregatorShell's — Collector
// nav grew from 4 flat items to 9 across 6 sections, past the point a flat
// list stays scannable.
interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: "Main",
    items: [
      { label: "Dashboard", href: "/account", icon: LayoutGrid },
      { label: "Discover", href: "/marketplace", icon: Compass },
      { label: "Wishlist", href: "/account/wishlist", icon: Heart },
    ],
  },
  {
    id: "collection",
    label: "My Collection",
    items: [
      { label: "My Collection", href: "/account/collection", icon: Frame },
    ],
  },
  {
    id: "purchases",
    label: "Purchases",
    items: [{ label: "Orders", href: "/account/orders", icon: ShoppingBag }],
  },
  {
    id: "finance",
    label: "Finance",
    items: [{ label: "Wallet", href: "/account/wallet", icon: Wallet }],
  },
  {
    id: "resale",
    label: "Resale",
    items: [
      { label: "Resell Artwork", href: "/account/resale", icon: Repeat2 },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { label: "Profile", href: "/account/settings", icon: CircleUserRound },
      { label: "Addresses", href: "/account/addresses", icon: MapPin },
      { label: "Support", href: "/account/support", icon: LifeBuoy },
    ],
  },
];

const ALL_GROUP_IDS = NAV_GROUPS.map((g) => g.id);
const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function AccountShell({ children }: { children: React.ReactNode }) {
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

function isItemActive(pathname: string, href: string) {
  if (href === "/account") return pathname === "/account";
  return pathname.startsWith(href);
}

function NavLink({
  item,
  collapsed,
  onClick,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
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
        className={cn("size-4 shrink-0", active && "text-gold-bright")}
        strokeWidth={1.75}
      />
      <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>
        {item.label}
      </span>
    </Link>
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
  // All groups open by default — see AggregatorShell's identical note on
  // why a collapsed group doesn't auto-reopen when you land on its page.
  const [openGroups, setOpenGroups] = useState<string[]>(ALL_GROUP_IDS);

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
          <SidebarBrand collapsed={collapsed} />
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
          Collector Portal
        </span>

        <div className="flex-1 overflow-y-auto px-3 py-1">
          {collapsed ? (
            <nav className="flex flex-col gap-1">
              {ALL_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  onClick={onClose}
                  active={isItemActive(pathname, item.href)}
                />
              ))}
            </nav>
          ) : (
            <Accordion
              multiple
              value={openGroups}
              onValueChange={(value) => setOpenGroups(value as string[])}
            >
              {NAV_GROUPS.map((group) => (
                <AccordionItem
                  key={group.id}
                  value={group.id}
                  className="border-b-0"
                >
                  <AccordionTrigger className="rounded-md px-2 py-2 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase no-underline hover:bg-sidebar-accent/40 hover:text-muted-foreground hover:no-underline **:data-[slot=accordion-trigger-icon]:size-3.5">
                    {group.label}
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    <nav className="flex flex-col gap-1 pt-1">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.href}
                          item={item}
                          collapsed={collapsed}
                          onClick={onClose}
                          active={isItemActive(pathname, item.href)}
                        />
                      ))}
                    </nav>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

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

const PAGE_TITLES: Record<string, string> = Object.fromEntries(
  ALL_ITEMS.filter((item) => item.href.startsWith("/account")).map((item) => [
    item.href,
    item.label,
  ]),
);
PAGE_TITLES["/account"] = "Dashboard";

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const title =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/account/orders/")
      ? "Order details"
      : "Collector Portal");

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
