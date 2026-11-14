"use client";

import { cn } from "@/lib/utils";
import type { QueueView } from "@/types/admin";

export type { QueueView };

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const VERB: Record<string, string> = { approved: "Approved", rejected: "Rejected", waived: "Waived" };

/** Waiting is what needs a decision; Reviewed is what an admin has already decided. */
export function QueueViewSwitch({ value, onChange }: { value: QueueView; onChange: (view: QueueView) => void }) {
  return (
    <div role="group" aria-label="Which items to show" className="mb-4 inline-flex rounded-lg border border-border p-0.5">
      {(["waiting", "reviewed"] as const).map((view) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => onChange(view)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === view ? "bg-gold/15 text-gold-bright" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {view === "waiting" ? "Waiting" : "Reviewed"}
        </button>
      ))}
    </div>
  );
}

/** The "Reviewed by" cell: what was decided, by which admin, and when. A dash when nobody has decided. */
export function ReviewedBy({ name, decision, at }: { name?: string | null; decision?: string | null; at?: string | null }) {
  if (!name) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-foreground">
        {decision ? `${VERB[decision] ?? decision} by ` : "By "}
        <span className="font-medium">{name}</span>
      </p>
      {at && <p className="text-xs text-muted-foreground">{dateFormat.format(new Date(at))}</p>}
    </div>
  );
}
