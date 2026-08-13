import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

// Shared shell for /terms, /privacy, /cookies: SiteHeader, a title block
// with a "Last updated" line, a two-column body (sticky LegalToc + article,
// both passed in as children so each page controls its own composition),
// then SiteFooter. Not route-grouped (per plan Global Constraints, only
// app/(auth)/ is a route group in this codebase) — these three routes each
// get their own flat app/<route>/page.tsx importing this same layout.
export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <>
      <SiteHeader />
      <main className="relative flex-1">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 py-16 lg:px-8 lg:py-20">
          <header className="max-w-3xl border-b border-border/60 pb-8">
            <h1 className="text-balance font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </header>

          <div className="flex flex-col gap-10 pt-10 lg:flex-row lg:gap-16">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
