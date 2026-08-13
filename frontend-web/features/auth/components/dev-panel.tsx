import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DevPanelProps {
  children: ReactNode;
  className?: string;
}

// Shared visual affordance for every "this only exists because there's no
// real backend" control across the Auth track (Register's simulate-error
// switch, Login's demo role picker, the dev-skip links on Forgot/Reset/
// Verify). Dashed gold border + a small "DEV" chip keeps every one of these
// instantly recognizable as non-production, per spec §3.
export function DevPanel({ children, className }: DevPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed border-gold/35 bg-gold/[0.04] px-3.5 py-3",
        className
      )}
    >
      <span className="shrink-0 rounded border border-gold/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-gold-bright">
        DEV
      </span>
      <div className="flex flex-1 items-center justify-between gap-3">
        {children}
      </div>
    </div>
  );
}
