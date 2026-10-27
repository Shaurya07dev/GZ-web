"use client";

import { useEffect, useState } from "react";

export type TourRole = "customer" | "artist" | "aggregator";

const STORAGE_PREFIX = "gz_tour_completed_";

// Per-role flag kept in localStorage. A fresh browser (new device, incognito,
// cleared storage) will show the tour again — acceptable for v1. If someone
// signs in on a second device and wants to escape the tour, Skip takes one tap.
// Upgrading to a Firestore-backed per-user flag is a one-line change later.
function storageKey(role: TourRole): string {
  return `${STORAGE_PREFIX}${role}`;
}

export function useOnboardingTour(role: TourRole) {
  const [shouldRun, setShouldRun] = useState(false);

  useEffect(() => {
    // Only run in the browser — localStorage is undefined during SSR.
    if (typeof window === "undefined") return;
    try {
      const completed = window.localStorage.getItem(storageKey(role));
      if (!completed) setShouldRun(true);
    } catch {
      // Private browsing can throw on localStorage access; a missed tour is
      // better than a crashed shell.
    }
  }, [role]);

  function markComplete() {
    setShouldRun(false);
    try {
      window.localStorage.setItem(storageKey(role), new Date().toISOString());
    } catch {
      // Same reason — don't surface a storage error to the user.
    }
  }

  function restart() {
    try {
      window.localStorage.removeItem(storageKey(role));
    } catch {
      // noop
    }
    setShouldRun(true);
  }

  return { shouldRun, markComplete, restart };
}
