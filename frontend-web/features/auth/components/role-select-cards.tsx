"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_OPTIONS } from "@/features/auth/data/role-options";
import type { Role } from "@/features/auth/schemas/auth-schemas";

interface RoleSelectCardsProps {
  selected?: Role;
  onSelect: (role: Role) => void;
}

export function RoleSelectCards({ selected, onSelect }: RoleSelectCardsProps) {
  return (
    <div
      className="flex flex-col gap-3"
      role="radiogroup"
      aria-label="Account type"
    >
      {ROLE_OPTIONS.map((option) => {
        const isSelected = option.role === selected;
        const Icon = option.icon;
        return (
          <motion.button
            key={option.role}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(option.role)}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={cn(
              "flex items-start gap-3.5 rounded-lg border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              isSelected
                ? "border-gold/60 bg-gold/[0.06]"
                : "border-border hover:border-gold/30 hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border",
                isSelected
                  ? "border-gold/50 bg-gold/10 text-gold-bright"
                  : "border-border text-muted-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-foreground">
                  {option.label}
                </span>
                {isSelected && (
                  <Check
                    className="size-4 shrink-0 text-gold-bright"
                    strokeWidth={2.5}
                  />
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
