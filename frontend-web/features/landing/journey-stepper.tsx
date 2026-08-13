"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import { JOURNEY_STEPS } from "./journey-data";

// Shared with journey-section.tsx's auto-advance timer so the visual fill
// and the actual step change never drift out of sync.
export const JOURNEY_STEP_DURATION_MS = 7000;

export function JourneyStepper({
  activeIndex,
  onSelect,
  autoAdvancing,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
  autoAdvancing: boolean;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {JOURNEY_STEPS.map((step, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={step.number}
            type="button"
            onClick={() => onSelect(i)}
            className={`relative shrink-0 px-3.5 py-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-5 ${
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            }`}
          >
            <span
              className={`mr-1.5 font-mono text-xs ${active ? "text-gold-bright" : "text-muted-foreground/60"}`}
            >
              {step.number}
            </span>
            {step.label}
            {active && (
              <motion.span
                layoutId="journey-tab-underline"
                className="absolute inset-x-3 -bottom-px h-[2px] overflow-hidden rounded-full bg-border"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              >
                {autoAdvancing ? (
                  <motion.span
                    key={activeIndex}
                    className="block h-full rounded-full bg-gold-bright"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: JOURNEY_STEP_DURATION_MS / 1000,
                      ease: "linear",
                    }}
                  />
                ) : (
                  // Paused (a tab was clicked): a static full bar rather
                  // than a fill animation that would imply it's still
                  // counting down toward a step change that isn't coming.
                  <span className="block h-full w-full rounded-full bg-gold-bright" />
                )}
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}
