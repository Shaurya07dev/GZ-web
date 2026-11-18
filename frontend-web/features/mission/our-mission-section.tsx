"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import { Check, Eye, Target } from "lucide-react";

// The company's own statement, as supplied by the client (18 Nov 2026): its Vision and its Mission, word for
// word. Only "Galleryzone" is written "GalleryZone" to match the brand spelling used everywhere on this site.
// The source document is headed "Vision, Mission, Core Values & Business Objectives" but the text supplied
// stops after the Mission, so the page shows those two and nothing is invented for the rest.
const VISION =
  "To become India's most trusted art ecosystem by connecting artists, collectors, businesses, and communities through innovation, transparency, and authentic creative experiences, while expanding the reach of original art across the world.";

const MISSION_LEAD =
  "GalleryZone is committed to building a technology-driven platform that empowers artists, simplifies art discovery, and creates meaningful opportunities for buyers and business partners.";

const MISSION_COMMITMENTS = [
  "Support artists by providing greater visibility and market access.",
  "Offer customers authentic, high-quality artwork through a transparent purchasing experience.",
  "Build partnerships with businesses that showcase original art in commercial spaces.",
  "Deliver professional services covering artwork verification, logistics, documentation, and customer support.",
  "Promote sustainable growth within the art community through ethical business practices.",
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function OurMissionSection() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-20 md:py-28">
      <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Our Mission
          </span>
          <h1 className="mt-4 text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
            Vision &amp; <span className="text-gold-bright">Mission.</span>
          </h1>
        </motion.div>

        <div className="mt-12 flex flex-col gap-8 md:mt-16">
          <motion.section
            aria-labelledby="vision-heading"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            variants={fadeUp}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-xl border border-gold/30 bg-card p-6 sm:p-8 md:p-10"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
                <Eye className="size-5 text-gold-bright" strokeWidth={1.75} />
              </span>
              <h2 id="vision-heading" className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                Vision
              </h2>
            </div>
            <p className="mt-5 max-w-3xl text-pretty text-lg leading-relaxed text-foreground/90 sm:text-xl">{VISION}</p>
          </motion.section>

          <motion.section
            aria-labelledby="mission-heading"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            variants={fadeUp}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-xl border border-border bg-card p-6 sm:p-8 md:p-10"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
                <Target className="size-5 text-gold-bright" strokeWidth={1.75} />
              </span>
              <h2 id="mission-heading" className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                Mission
              </h2>
            </div>
            <p className="mt-5 max-w-3xl text-pretty text-base leading-relaxed text-foreground/90 sm:text-lg">{MISSION_LEAD}</p>

            <h3 className="mt-8 text-sm font-semibold tracking-[0.14em] text-gold-bright uppercase">We strive to</h3>
            <ul className="mt-4 flex max-w-3xl flex-col gap-3.5">
              {MISSION_COMMITMENTS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-base leading-relaxed text-foreground/90">
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold/15">
                    <Check className="size-3 text-gold-bright" strokeWidth={2.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.section>
        </div>
      </div>
    </section>
  );
}
