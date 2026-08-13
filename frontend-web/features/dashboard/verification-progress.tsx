import Link from "next/link";
import { CircleCheckBig, Circle } from "lucide-react";
import { VERIFICATION_TIERS } from "./dashboard-data";

export function VerificationProgress() {
  return (
    <div className="rounded-lg border border-gold/25 bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">
          Verification
        </h2>
        <span className="text-xs text-gold-bright">
          Unlocks the Gold ✦ Verified badge
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {VERIFICATION_TIERS.map((tier) => (
          <li key={tier.tier} className="flex items-start gap-3">
            {tier.status === "complete" ? (
              <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-gold-bright" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
            )}
            <div>
              <p
                className={`text-sm ${
                  tier.status === "complete"
                    ? "text-foreground"
                    : "text-foreground/80"
                }`}
              >
                Tier {tier.tier}: {tier.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {tier.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/verification"
        className="mt-4 inline-flex text-sm font-medium text-gold-bright hover:underline"
      >
        Complete your first sale
      </Link>
    </div>
  );
}
