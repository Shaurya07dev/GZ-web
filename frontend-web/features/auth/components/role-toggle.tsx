"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface RoleToggleProps<T extends string> {
  options: RoleToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

// Separate standalone buttons, not one connected segmented pill — each role
// is its own discrete choice, not steps along a single track. Shared by
// Register (3 self-service roles) and Login (those 3 plus Admin — this
// toggle IS how "sign in as" works here, since there's no backend to know
// an account's role).
export function RoleToggle<T extends string>({
  options,
  value,
  onChange,
  className,
}: RoleToggleProps<T>) {
  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "border-gold-bright bg-gold-bright text-[#171310]"
                : "border-border text-muted-foreground hover:border-gold-bright/50 hover:text-foreground",
            )}
          >
            {Icon && <Icon className="size-4" />}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
