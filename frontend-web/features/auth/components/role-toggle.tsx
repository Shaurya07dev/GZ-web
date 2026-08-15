"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RoleToggleOption<T extends string> {
  value: T;
  label: string;
}

interface RoleToggleProps<T extends string> {
  options: RoleToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  className?: string;
}

// Segmented pill control: press a segment, the form updates in place —
// no page/step transition. Shared by Register (3 real roles) and Login
// (adds Admin, since there's no backend to know an account's role — this
// toggle IS how "sign in as" works here, not a hidden dev affordance).
// Generic over the value union so one component serves both Role and
// DemoRole without duplicating the sliding-indicator logic.
export function RoleToggle<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className,
}: RoleToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-full border border-border bg-muted/40 p-1",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "text-[#171310]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className="absolute inset-0 rounded-full bg-gold-bright"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
