"use client";

import { Checkbox } from "@/components/ui/checkbox";

// ---------------------------------------------------------------------------
// The five criteria are verbatim from the platform's own onboarding workflow
// (markitdown/Artist Complete workflow.md, "Eligibility checklist"). They are
// not decoration: Approve stays disabled until every one is ticked, because
// this checklist IS the curator gate the workflow describes. Rejecting needs
// no checklist — you can reject on the first thing you notice.
// ---------------------------------------------------------------------------

export const ELIGIBILITY_CRITERIA = [
  {
    id: "handmade",
    label: "100% handmade",
    detail: "Physically made by the artist, not machine-produced.",
  },
  {
    id: "no-replicas",
    label: "No replicas",
    detail: "Not a copy or reproduction of an existing work.",
  },
  {
    id: "no-ai",
    label: "No AI, digital prints, or NFTs",
    detail: "Original physical media only.",
  },
  {
    id: "owns-rights",
    label: "Artist owns all rights",
    detail: "No commissioned or work-for-hire claims outstanding.",
  },
  {
    id: "no-infringement",
    label: "No IP infringement",
    detail: "No third-party trademarks, characters, or protected imagery.",
  },
] as const;

export type EligibilityId = (typeof ELIGIBILITY_CRITERIA)[number]["id"];

export function EligibilityChecklist({
  checked,
  onToggle,
  disabled = false,
}: {
  checked: Record<string, boolean>;
  onToggle: (id: EligibilityId, next: boolean) => void;
  disabled?: boolean;
}) {
  const clearedCount = ELIGIBILITY_CRITERIA.filter((c) => checked[c.id]).length;
  const total = ELIGIBILITY_CRITERIA.length;

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Eligibility check
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            All five must clear before this can be approved.
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {clearedCount}/{total}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {ELIGIBILITY_CRITERIA.map((criterion) => {
          const isChecked = Boolean(checked[criterion.id]);
          return (
            <li key={criterion.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40 ${
                  disabled ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(next) => onToggle(criterion.id, next === true)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {criterion.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {criterion.detail}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
