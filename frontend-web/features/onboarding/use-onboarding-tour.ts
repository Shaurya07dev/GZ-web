"use client";

import { useEffect, useState } from "react";
import { profileApi } from "@/services/profileApi";

export type TourRole = "customer" | "artist" | "aggregator" | "admin";

// Bump a role's number when its steps change meaningfully: everyone who saw
// the old tour gets the new one once.
export const TOUR_VERSION: Record<TourRole, number> = { customer: 1, artist: 1, aggregator: 1, admin: 1 };

// "Replay tour" buttons fire this; the mounted tour for the role restarts.
export const REPLAY_TOUR_EVENT = "gz:replay-tour";

// v1 kept only `gz_tour_completed_<role>` (no version); it counts as v1 so
// nobody who finished it is shown it again.
const localKey = (role: TourRole, version: number) =>
  version === 1 ? `gz_tour_completed_${role}` : `gz_tour_completed_${role}_v${version}`;

function readLocal(role: TourRole, version: number): boolean {
  try {
    return Boolean(window.localStorage.getItem(localKey(role, version)));
  } catch {
    return false; // private mode can throw; the account copy decides then
  }
}

function writeLocal(role: TourRole, version: number) {
  try {
    window.localStorage.setItem(localKey(role, version), new Date().toISOString());
  } catch {
    // noop: the account copy is the one that matters
  }
}

// Completion lives on the account (so a second device doesn't replay it),
// with localStorage as a fast path that skips the request.
export function useOnboardingTour(role: TourRole) {
  const [shouldRun, setShouldRun] = useState(false);
  const version = TOUR_VERSION[role];

  useEffect(() => {
    if (readLocal(role, version)) return;
    let cancelled = false;
    profileApi
      .get()
      .then((profile) => {
        if (cancelled) return;
        if ((profile.toursCompleted?.[role] ?? 0) >= version) writeLocal(role, version);
        else setShouldRun(true);
      })
      // Can't tell: don't cover the page with a tour while the API is failing.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [role, version]);

  useEffect(() => {
    const replay = (e: Event) => {
      if ((e as CustomEvent<TourRole>).detail === role) setShouldRun(true);
    };
    window.addEventListener(REPLAY_TOUR_EVENT, replay);
    return () => window.removeEventListener(REPLAY_TOUR_EVENT, replay);
  }, [role]);

  function markComplete() {
    setShouldRun(false);
    writeLocal(role, version);
    void profileApi.update({ tourCompleted: { tour: role, version } }).catch(() => undefined);
  }

  return { shouldRun, markComplete };
}

export function replayTour(role: TourRole) {
  window.dispatchEvent(new CustomEvent<TourRole>(REPLAY_TOUR_EVENT, { detail: role }));
}
