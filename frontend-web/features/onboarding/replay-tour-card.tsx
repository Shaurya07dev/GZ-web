"use client";

import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { replayTour, type TourRole } from "./use-onboarding-tour";

// The first-login walkthrough, on demand: for someone who skipped it, or
// came back after a while and wants the lay of the land again.
export function ReplayTourCard({ role }: { role: TourRole }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-5">
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">New here, or need a refresher?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Walk through the main parts of your account again.</p>
      </div>
      <Button variant="outline" onClick={() => replayTour(role)}>
        <Compass className="size-4" strokeWidth={1.75} />
        Replay the tour
      </Button>
    </div>
  );
}
