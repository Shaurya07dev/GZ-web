"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { VERIFICATION_TIERS, GOLD_VERIFIED } from "./about-data";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// The header's "How It Works" link points to /about#how-it-works — this
// section is the anchor target, since the 3-tier verification system is
// the platform mechanic buyers and artists most concretely need explained.
export function VerificationTiersSection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-balance font-display text-3xl leading-[1.15] font-semibold sm:text-4xl">
            How verification works.
          </h2>
          <p className="mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground">
            Three tiers confirm an artist&rsquo;s identity, activity, and
            track record, so anyone browsing a listing can see exactly how
            established the artist is.
          </p>
        </motion.div>

        <motion.div
          className="relative mt-16"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
        >
          <div
            className="absolute inset-x-0 top-7 hidden h-px bg-gradient-to-r from-border via-gold/40 to-gold/70 lg:block"
            aria-hidden
          />

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {VERIFICATION_TIERS.map((tier) => (
              <TierNode
                key={tier.tier}
                label={`Tier ${tier.tier}`}
                title={tier.title}
                description={tier.description}
                icon={tier.icon}
              />
            ))}
            <TierNode
              label="Result"
              title={GOLD_VERIFIED.title}
              description={GOLD_VERIFIED.description}
              icon={GOLD_VERIFIED.icon}
              gold
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function TierNode({
  label,
  title,
  description,
  icon: Icon,
  gold = false,
}: {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gold?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
      <span
        className={cn(
          "relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border bg-background",
          gold ? "border-gold bg-gold/15" : "border-gold/40 bg-card"
        )}
      >
        <Icon
          className={cn("size-6", gold ? "text-gold-bright" : "text-gold-bright/85")}
          strokeWidth={1.5}
        />
      </span>

      <div className="mt-4">
        <p
          className={cn(
            "text-xs font-medium tracking-[0.14em]",
            gold ? "text-gold-bright" : "text-muted-foreground"
          )}
        >
          {label.toUpperCase()}
        </p>
        <h3 className="mt-1.5 font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
