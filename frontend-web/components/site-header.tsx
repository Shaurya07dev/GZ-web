import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SwitchMode } from "./switch-mode";

const NAV_LINKS = [
  { label: "Explore", href: "/marketplace" },
  { label: "For Artists", href: "/for-artists" },
  { label: "For Collectors", href: "/for-collectors" },
  { label: "For Galleries", href: "/for-galleries" },
  { label: "About", href: "/about" },
  { label: "How It Works", href: "/about#how-it-works" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/75 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 lg:px-10">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl font-semibold italic text-gold-bright">
            GZ
          </span>
          <span className="text-sm font-medium tracking-[0.18em] text-foreground">
            GALLERYZONE
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm whitespace-nowrap text-foreground/85 transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <SwitchMode />

          <Link
            href="/register?role=artist"
            className="group hidden items-center gap-2 rounded-md border border-gold/50 px-4 py-2 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 sm:inline-flex"
          >
            Become an Early Artist
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
