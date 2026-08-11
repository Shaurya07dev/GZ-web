"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";

const SLOTS = [
  { label: "01", cardIndex: 0 },
  { label: "02", cardIndex: 1 },
  { label: null, cardIndex: null },
  { label: "03", cardIndex: 2 },
  { label: "04", cardIndex: 3 },
] as const;

export function IdentityTimeline({
  activeIndex,
}: {
  activeIndex: number | null;
}) {
  return (
    <div className="relative mb-6 hidden h-16 lg:block" aria-hidden>
      <svg
        viewBox="0 0 1000 64"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M 4 44 C 30 44 34 4 60 4 L 940 4 C 966 4 970 44 996 44"
          fill="none"
          stroke="var(--gold)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
        <circle cx="4" cy="44" r="4" fill="var(--gold)" fillOpacity="0.85" />
        <circle cx="996" cy="44" r="4" fill="var(--gold)" fillOpacity="0.85" />
      </svg>

      <div className="grid h-full grid-cols-[1fr_1fr_1.05fr_1fr_1fr]">
        {SLOTS.map((slot, i) => (
          <div
            key={i}
            className="relative flex flex-col items-center justify-start pt-1"
            style={{ gridColumn: i + 1 }}
          >
            {slot.label && (
              <>
                <span className="font-mono text-sm text-muted-foreground/70">
                  {slot.label}
                </span>
                <motion.span
                  className="mt-3 size-1.5 rounded-full bg-gold"
                  animate={{
                    scale: activeIndex === slot.cardIndex ? 1.6 : 1,
                    opacity: activeIndex === slot.cardIndex ? 1 : 0.85,
                  }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
