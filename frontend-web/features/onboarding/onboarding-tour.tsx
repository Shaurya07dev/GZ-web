"use client";

import { useCallback } from "react";
// Joyride is a client-only component that touches `window` at import time, so
// the shell dynamically imports this file (see each shell) rather than
// pulling it into the server bundle. v3 renamed `callback` → `onEvent` and
// moved options like showProgress/skipBeacon into an `options` object.
import { Joyride, STATUS, type EventData, type Props } from "react-joyride";
import {
  ARTIST_TOUR_STEPS,
  AGGREGATOR_TOUR_STEPS,
  CUSTOMER_TOUR_STEPS,
} from "./tour-steps";
import { useOnboardingTour, type TourRole } from "./use-onboarding-tour";

const STEPS: Record<TourRole, typeof CUSTOMER_TOUR_STEPS> = {
  customer: CUSTOMER_TOUR_STEPS,
  artist: ARTIST_TOUR_STEPS,
  aggregator: AGGREGATOR_TOUR_STEPS,
};

// Default options merged into every step. In v3 these live on the `options`
// object (shared across steps) rather than scattered across root-level props
// like v2. Styling theme matches the dark GalleryZone palette; the gold
// primary mirrors every other primary action in the app.
const SHARED_OPTIONS: Props["options"] = {
  primaryColor: "#b8892b",       // --gold-bright, approximate
  textColor: "#f3ead9",           // --foreground on dark
  backgroundColor: "#1b1612",
  arrowColor: "#1b1612",
  overlayColor: "rgba(0, 0, 0, 0.72)",
  zIndex: 10_000,                 // above the Radix dialog's 50; well below Razorpay's own iframe layer
  showProgress: true,
  skipBeacon: true,               // open the tooltip immediately, don't require a beacon click
  // Buttons: Back, Skip (ends the tour), Primary (Next / Done on last).
  // Omitting 'close' because Skip already covers "I'm done here".
  buttons: ["back", "skip", "primary"],
};

// `locale` lives on SharedProps (root-level), not inside `options`. Default
// English strings are fine; override here only to say "Skip tour" instead of
// "Skip" so it's clear this ends the whole walkthrough, not just one step.
const LOCALE: Props["locale"] = {
  back: "Back",
  close: "Close",
  last: "Done",
  next: "Next",
  skip: "Skip tour",
};

export function OnboardingTour({ role }: { role: TourRole }) {
  const { shouldRun, markComplete } = useOnboardingTour(role);

  const handleEvent = useCallback(
    (data: EventData) => {
      const { status } = data;
      // Two terminal states: FINISHED (user clicked Done) and SKIPPED (user
      // hit Skip). Treat both as "they're done, don't nag again".
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        markComplete();
      }
    },
    [markComplete],
  );

  if (!shouldRun) return null;

  return (
    <Joyride
      steps={STEPS[role]}
      run
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={SHARED_OPTIONS}
      locale={LOCALE}
    />
  );
}
