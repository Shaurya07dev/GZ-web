"use client";

import "@/lib/motion-config";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { JourneyStepper } from "./journey-stepper";
import { JourneyStepDetail } from "./journey-step-detail";
import { JOURNEY_STEPS } from "./journey-data";

export function JourneySection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const step = JOURNEY_STEPS[activeIndex];

  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <motion.div
          className="flex flex-col gap-10 xl:flex-row xl:items-start xl:justify-between xl:gap-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="max-w-md shrink-0">
            <p className="text-sm font-medium tracking-[0.14em] text-gold-bright">
              04 <span className="text-gold/50">•</span> THE ARTWORK JOURNEY
            </p>
            <h2 className="mt-4 text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
              From the artist&rsquo;s hands to the{" "}
              <span className="text-gold-bright">collector&rsquo;s</span>{" "}
              walls.
            </h2>
            <p className="mt-5 text-balance text-sm leading-relaxed text-muted-foreground">
              Every artwork moves through a trusted journey — from
              submission and verification to sale and ownership.
            </p>
          </div>

          <div className="w-full pt-2 xl:max-w-2xl">
            <JourneyStepper activeIndex={activeIndex} onSelect={setActiveIndex} />

            <AnimatePresence mode="wait">
              <motion.p
                key={step.number}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="mt-6 text-balance font-display text-xl font-semibold text-foreground sm:text-2xl"
              >
                {step.description}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <JourneyStepDetail step={step} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
