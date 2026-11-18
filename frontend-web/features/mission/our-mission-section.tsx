"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import { Eye, Target } from "lucide-react";

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

const rise = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export function OurMissionSection() {
  return (
    <section className="relative overflow-hidden">
      {/* A warm light behind the heading, so the page opens like a gallery wall rather than a form. */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative mx-auto max-w-[1200px] px-6 py-16 sm:py-20 md:py-28 lg:px-10">
        {/* ── Opening ─────────────────────────────────────────────────────── */}
        <motion.header initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
          <motion.span
            variants={rise}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1 text-xs font-medium tracking-[0.16em] text-gold-bright uppercase"
          >
            Our Mission
          </motion.span>
          <motion.h1
            variants={rise}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mt-6 text-balance font-display text-5xl leading-[1.05] font-semibold sm:text-6xl md:text-7xl"
          >
            Vision{" "}
            <span className="bg-gradient-to-r from-gold-deep via-gold to-gold-bright bg-clip-text text-transparent">&amp; Mission.</span>
          </motion.h1>
          <motion.div variants={rise} transition={{ duration: 0.6, ease: "easeOut" }} className="mt-8 h-px w-24 bg-gradient-to-r from-gold to-transparent" />
        </motion.header>

        {/* ── Vision: one sentence, set large ──────────────────────────────── */}
        <motion.section
          aria-labelledby="vision-heading"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-12%" }}
          variants={rise}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative mt-16 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.12] via-card to-card p-7 sm:p-10 md:mt-24 md:p-14"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -top-6 right-6 select-none font-display text-[10rem] leading-none text-gold/10 sm:text-[14rem]"
          >
            &rdquo;
          </span>
          <div className="relative flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
              <Eye className="size-5 text-gold-bright" strokeWidth={1.75} />
            </span>
            <h2 id="vision-heading" className="text-sm font-semibold tracking-[0.2em] text-gold-bright uppercase">
              Vision
            </h2>
          </div>
          <p className="relative mt-7 max-w-4xl text-pretty font-display text-2xl leading-snug font-medium text-foreground sm:text-3xl md:text-[2.15rem] md:leading-[1.3]">
            {VISION}
          </p>
        </motion.section>

        {/* ── Mission: the promise on the left, the five commitments on the right ── */}
        <section aria-labelledby="mission-heading" className="mt-20 grid grid-cols-1 gap-10 md:mt-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-12%" }}
            variants={rise}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
                <Target className="size-5 text-gold-bright" strokeWidth={1.75} />
              </span>
              <h2 id="mission-heading" className="text-sm font-semibold tracking-[0.2em] text-gold-bright uppercase">
                Mission
              </h2>
            </div>
            <p className="mt-6 text-pretty font-display text-2xl leading-snug font-medium text-foreground sm:text-3xl">{MISSION_LEAD}</p>
            <h3 className="mt-8 text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">We strive to</h3>
          </motion.div>

          <motion.ul
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-8%" }}
            variants={stagger}
            className="flex flex-col gap-4 [counter-reset:commitment]"
          >
            {MISSION_COMMITMENTS.map((item) => (
              <motion.li
                key={item}
                variants={rise}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="group relative rounded-xl border border-border bg-card px-6 py-5 pl-20 text-base leading-relaxed text-foreground/90 transition-[border-color,transform,background-color] duration-300 [counter-increment:commitment] before:absolute before:top-5 before:left-6 before:font-display before:text-3xl before:leading-none before:font-semibold before:text-gold/70 before:content-[counter(commitment,decimal-leading-zero)] hover:-translate-y-0.5 hover:border-gold/40 hover:bg-gold/[0.04] sm:text-lg sm:before:text-4xl sm:pl-24"
              >
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </section>
      </div>
    </section>
  );
}
