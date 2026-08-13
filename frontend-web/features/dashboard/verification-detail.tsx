"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CircleCheckBig, Circle, Sparkles, ArrowRight } from "lucide-react";
import { InstagramGlyph } from "@/components/social-icons";
import { VERIFICATION_TIERS, PROFILE, ARTIST } from "./dashboard-data";

const TOTAL_TIERS = VERIFICATION_TIERS.length;
const completedCount = VERIFICATION_TIERS.filter(
  (t) => t.status === "complete",
).length;

export function VerificationDetail() {
  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-lg border border-gold/25 bg-card p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <Sparkles
                className="size-5 text-gold-bright"
                strokeWidth={1.75}
              />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">
                Tier {ARTIST.verifiedTier} of {TOTAL_TIERS} verified
              </h2>
              <p className="text-sm text-muted-foreground">
                Complete Tier 3 to unlock the Gold ✦ Verified badge.
              </p>
            </div>
          </div>
          <span className="font-mono text-sm text-muted-foreground">
            {completedCount} / {TOTAL_TIERS} complete
          </span>
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-bright"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / TOTAL_TIERS) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          />
        </div>
      </motion.div>

      <div className="flex flex-col gap-4">
        {VERIFICATION_TIERS.map((tier, i) => (
          <motion.div
            key={tier.tier}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
            className={`rounded-lg border p-5 sm:p-6 ${
              tier.status === "complete"
                ? "border-border bg-card"
                : "border-gold/30 bg-card"
            }`}
          >
            <div className="flex items-start gap-4">
              {tier.status === "complete" ? (
                <CircleCheckBig className="mt-0.5 size-5 shrink-0 text-gold-bright" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-gold-bright/60" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Tier {tier.tier}: {tier.title}
                  </h3>
                  {tier.status === "complete" ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      Complete
                    </span>
                  ) : (
                    <span className="rounded-full border border-gold/35 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold-bright">
                      In progress
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {tier.detail}
                </p>

                {tier.status === "complete" && tier.completedOn && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Completed on{" "}
                    {new Date(tier.completedOn).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}

                {tier.tier === 1 && tier.status === "complete" && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground">
                    <InstagramGlyph className="size-3.5 text-gold-bright" />@
                    {PROFILE.instagram}
                  </div>
                )}

                {tier.status !== "complete" && (
                  <Link
                    href="/dashboard/artworks"
                    className="group mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-bright hover:underline"
                  >
                    View your artworks
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
