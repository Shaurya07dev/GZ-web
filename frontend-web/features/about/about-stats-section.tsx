"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import { mockArtworks } from "@/lib/mock-data/artworks";
import { mockArtists } from "@/lib/mock-data/artists";
import { VERIFICATION_TIERS } from "./about-data";

// Real counts from the current catalog fixtures rather than invented
// vanity metrics -- GalleryZone's own marketing already frames itself as
// early-stage (see "Become an Early Artist" CTAs), so this states what's
// actually on the platform today instead of a fabricated user base.
const CATEGORY_COUNT = new Set(mockArtworks.map((a) => a.category)).size;

const STATS = [
  {
    value: `${mockArtworks.length}`,
    label: "Artworks listed",
    sublabel: `across ${CATEGORY_COUNT} mediums`,
  },
  {
    value: `${mockArtists.length}`,
    label: "Artists onboard",
    sublabel: "and growing",
  },
  {
    value: `${CATEGORY_COUNT}`,
    label: "Mediums",
    sublabel: "painting to mixed media",
  },
  {
    value: `${VERIFICATION_TIERS.length}`,
    label: "Verification tiers",
    sublabel: "identity to first sale",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function AboutStatsSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <motion.div
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="max-w-xl">
            <p className="text-xs font-medium tracking-[0.16em] text-gold-bright uppercase">
              By the numbers
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl leading-[1.15] font-semibold sm:text-4xl">
              What&rsquo;s on GalleryZone right now.
            </h2>
          </div>
          <p className="max-w-sm text-balance text-sm leading-relaxed text-muted-foreground">
            A small, growing catalog — every artist verified the same way,
            every price kept private.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col gap-6 py-8 first:pt-8 sm:px-8 sm:first:pl-0 sm:last:pr-0"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-5xl font-semibold text-foreground tabular-nums sm:text-6xl">
                {stat.value}
              </span>
              <div>
                <p className="font-medium text-foreground">{stat.label}</p>
                <p className="text-sm text-muted-foreground">{stat.sublabel}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
