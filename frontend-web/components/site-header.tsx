"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Heart,
  Menu,
  Palette,
  Search,
  ShieldCheck,
} from "lucide-react";
import { SwitchMode } from "./switch-mode";
import { ArtistSurveyBanner } from "@/features/landing/artist-survey-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { mockArtworks } from "@/lib/mock-data/artworks";

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

const CATEGORY_ORDER = [
  "painting",
  "sculpture",
  "photography",
  "printmaking",
  "textile art",
  "mixed media",
] as const;

const EXPLORE_CATEGORIES = CATEGORY_ORDER.map((category) => {
  const items = mockArtworks.filter((artwork) => artwork.category === category);
  return {
    category,
    label: titleCase(category),
    count: items.length,
  };
});

const SELL_WITH_US = [
  {
    icon: Palette,
    title: "Sell as an Artist",
    description:
      "List original work, keep your price private, get paid in full 7 days after sale.",
    href: "/register?role=artist",
  },
  {
    icon: Building2,
    title: "Partner as a Gallery",
    description:
      "Display verified artwork in your space and earn a share of every sale you help make.",
    href: "/register?role=aggregator",
  },
  {
    icon: ClipboardList,
    title: "Take the Artist Survey",
    description:
      "A 2 minute survey about your art and practice. No account needed.",
    href: "/artist-survey",
  },
];

const SIMPLE_LINKS = [
  { label: "Explore", href: "/marketplace" },
  { label: "Artists", href: "/artists" },
  { label: "About", href: "/about" },
];

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  // The landing page is pure storytelling/onboarding, not a browsing
  // surface — search and wishlist only make sense once there's a catalog
  // on screen to act on (marketplace, artists, etc.), so both are hidden
  // here and nowhere else.
  const isLandingPage = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function handleSearchSubmit(query: string) {
    const trimmed = query.trim();
    router.push(
      trimmed
        ? `/marketplace?q=${encodeURIComponent(trimmed)}`
        : "/marketplace",
    );
    setMobileOpen(false);
    setSearchOpen(false);
  }

  return (
    <div className="sticky top-0 z-50 flex flex-col">
      <ArtistSurveyBanner />
      <header className="w-full border-b border-border/60 bg-background/75 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-6 lg:px-10">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-semibold italic text-gold-bright">
              GZ
            </span>
            <span className="text-sm font-medium tracking-[0.18em] text-foreground">
              GALLERYZONE
            </span>
          </Link>

          <NavigationMenu className="hidden max-w-none flex-1 justify-center lg:flex">
            <NavigationMenuList>
              {SIMPLE_LINKS.map((link) => (
                <NavigationMenuItem key={link.href}>
                  <NavigationMenuLink
                    render={<Link href={link.href} />}
                    className={navigationMenuTriggerStyle()}
                  >
                    {link.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}

              <NavigationMenuItem>
                <NavigationMenuTrigger>Sell With Us</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="grid w-[420px] gap-1 p-2">
                    {SELL_WITH_US.map((option) => (
                      <NavigationMenuLink
                        key={option.href}
                        render={
                          <Link
                            href={option.href}
                            className="items-start gap-3"
                          />
                        }
                      >
                        <option.icon
                          className="mt-0.5 size-4 text-gold-bright"
                          strokeWidth={1.75}
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{option.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </NavigationMenuLink>
                    ))}
                    <NavigationMenuLink
                      render={
                        <Link href="/about#how-it-works" className="gap-2" />
                      }
                    >
                      <ShieldCheck
                        className="size-4 text-gold-bright"
                        strokeWidth={1.75}
                      />
                      <span className="font-medium">
                        How Price Privacy &amp; Verification Work
                      </span>
                    </NavigationMenuLink>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {!isLandingPage && (
              <>
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Search artworks"
                        className="hidden sm:inline-flex"
                      />
                    }
                  >
                    <Search className="size-4" strokeWidth={1.75} />
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSearchSubmit(searchQuery);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search artworks"
                        className="h-9"
                      />
                      <Button
                        type="submit"
                        size="icon-sm"
                        variant="outline"
                        aria-label="Search"
                      >
                        <Search className="size-3.5" />
                      </Button>
                    </form>
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  nativeButton={false}
                  render={
                    <Link href="/account/wishlist" aria-label="Wishlist" />
                  }
                >
                  <Heart className="size-4" strokeWidth={1.75} />
                </Button>
              </>
            )}

            <Link
              href="/login"
              className="hidden text-sm text-foreground/85 transition-colors hover:text-foreground md:inline-block"
            >
              Sign In
            </Link>

            <SwitchMode />

            <Link
              href="/register?role=artist"
              className="group hidden items-center gap-2 rounded-md border border-gold/50 px-4 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 sm:inline-flex"
            >
              Become an Early Artist
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" strokeWidth={1.75} />
            </Button>
          </div>
        </div>

        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent className="top-0 right-0 left-auto h-full max-h-none w-full max-w-xs translate-x-0 translate-y-0 overflow-y-auto rounded-none border-l border-border/60 sm:max-w-xs">
            <DialogTitle className="sr-only">Navigation menu</DialogTitle>

            {!isLandingPage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchSubmit(mobileQuery);
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={mobileQuery}
                  onChange={(e) => setMobileQuery(e.target.value)}
                  placeholder="Search artworks"
                  className="h-10"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="outline"
                  aria-label="Search"
                >
                  <Search className="size-4" />
                </Button>
              </form>
            )}

            <nav className="flex flex-col gap-1 text-sm">
              <p className="mt-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Explore
              </p>
              {EXPLORE_CATEGORIES.map(({ category, label }) => (
                <Link
                  key={category}
                  href={`/marketplace?category=${encodeURIComponent(category)}`}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-2 py-2 hover:bg-muted"
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/marketplace"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 font-medium text-gold-bright hover:bg-muted"
              >
                Browse all artworks
              </Link>

              {SIMPLE_LINKS.filter((link) => link.href !== "/marketplace").map(
                (link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="mt-1 rounded-md px-2 py-2 hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ),
              )}

              <p className="mt-3 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Sell With Us
              </p>
              {SELL_WITH_US.map((option) => (
                <Link
                  key={option.href}
                  href={option.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-2 py-2 hover:bg-muted"
                >
                  {option.title}
                </Link>
              ))}

              <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4">
                {!isLandingPage && (
                  <Link
                    href="/account/wishlist"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-2 py-2 hover:bg-muted"
                  >
                    Wishlist
                  </Link>
                )}
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-2 py-2 hover:bg-muted"
                >
                  Sign In
                </Link>
                <Link
                  href="/register?role=artist"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-gold/50 px-4 py-2 text-center font-medium text-gold-bright hover:border-gold hover:bg-gold/10"
                >
                  Become an Early Artist
                </Link>
              </div>
            </nav>
          </DialogContent>
        </Dialog>
      </header>
    </div>
  );
}
