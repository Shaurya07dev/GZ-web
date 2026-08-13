"use client";

import "@/lib/motion-config";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { JourneyStepper, JOURNEY_STEP_DURATION_MS } from "./journey-stepper";
import { JourneyStepDetail } from "./journey-step-detail";
import { JOURNEY_STEPS } from "./journey-data";

export function JourneySection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoAdvancing, setAutoAdvancing] = useState(true);
  const step = JOURNEY_STEPS[activeIndex];

  // Auto-advance only reschedules while `autoAdvancing` is true. A manual
  // tab click turns it off for good (handleSelect below), so picking a step
  // means staying on it — not just restarting the same countdown.
  useEffect(() => {
    if (!autoAdvancing) return;
    const timer = setTimeout(() => {
      setActiveIndex((i) => (i + 1) % JOURNEY_STEPS.length);
    }, JOURNEY_STEP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, autoAdvancing]);

  function handleSelect(index: number) {
    setActiveIndex(index);
    setAutoAdvancing(false);
  }

  return (
    <section className="relative overflow-hidden py-28 md:py-36">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <motion.div
          className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div>
            <p className="text-sm font-medium tracking-[0.14em] text-gold-bright">
              04 <span className="text-gold/50">•</span> THE ARTWORK JOURNEY
            </p>
            <h2 className="mt-4 text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
              From the artist&rsquo;s hands to the
              <br />
              <span className="text-gold-bright">collector&rsquo;s</span> walls.
            </h2>
          </div>
          <p className="max-w-sm text-balance text-base text-muted-foreground">
            Every artwork moves through a trusted journey, from submission and
            verification to sale and ownership.
          </p>
        </motion.div>

        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        >
          <JourneyStepper
            activeIndex={activeIndex}
            onSelect={handleSelect}
            autoAdvancing={autoAdvancing}
          />

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

          <div className="mt-8">
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
          </div>
        </motion.div>
      </div>
    </section>
  );
}
