"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { TECH_FEATURES } from "./about-data";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function TechFeaturesSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-balance font-display text-3xl leading-[1.15] font-semibold sm:text-4xl">
            Technology built into every artwork.
          </h2>
          <p className="mt-4 max-w-xl text-balance text-base leading-relaxed text-muted-foreground">
            Every listing carries a growing layer of technology, tracked
            through the artwork&rsquo;s life on the platform.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {TECH_FEATURES.map((feature) => (
            <FeatureColumn key={feature.title} feature={feature} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FeatureColumn({
  feature,
}: {
  feature: { title: string; description: string; icon: LucideIcon };
}) {
  const Icon = feature.icon;

  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col gap-4 py-8 first:pt-0 last:pb-0 sm:px-8 sm:py-0 sm:first:pl-0 sm:last:pr-0"
    >
      <Icon className="size-6 text-gold-bright" strokeWidth={1.5} />
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          {feature.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}
