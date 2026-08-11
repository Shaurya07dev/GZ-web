"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import { JOURNEY_STEPS } from "./journey-data";

export function JourneyStepper({
  activeIndex,
  onSelect,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
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
                className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gold-bright"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
