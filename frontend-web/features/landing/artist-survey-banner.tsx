"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StickyBanner } from "@/components/ui/sticky-banner";

// The public, no-login artist survey (app/artist-survey/page.tsx) has no
// account/session to track "already responded" against, so completion is
// tracked the same way dismissal is: a localStorage flag, nothing server-side.
const STORAGE_KEY = "gz-public-artist-survey-dismissed";

export function ArtistSurveyBanner() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Deferred off the initial render (matches SwitchMode's pattern) so the
    // server-rendered "not dismissed" state doesn't mismatch a client that
    // already has the flag set.
    requestAnimationFrame(() => {
      if (localStorage.getItem(STORAGE_KEY)) setDismissed(true);
    });
  }, []);

  if (dismissed || pathname === "/artist-survey") return null;

  return (
    <StickyBanner
      className="static bg-gradient-to-r from-gold-deep via-gold to-gold-deep"
      hideOnScroll
      onDismiss={() => localStorage.setItem(STORAGE_KEY, "1")}
    >
      <p className="mx-0 max-w-[85%] pr-2 text-xs text-primary-foreground sm:text-sm">
        Are you an artist? Tell us about your work in a 2 minute survey.{" "}
        <Link
          href="/artist-survey"
          className="font-medium underline underline-offset-2 hover:no-underline"
        >
          Start now
        </Link>
      </p>
    </StickyBanner>
  );
}
