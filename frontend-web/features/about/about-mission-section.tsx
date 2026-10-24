"use client";

import "@/lib/motion-config";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

// Verbatim from the source document ("Gz Mission.pdf") — only "Galleryzone"
// was normalized to "GalleryZone" to match this site's brand spelling
// everywhere else; wording, sentences, and the bullet list are unchanged,
// not paraphrased or reordered. Distinct from AboutOverviewSection's short
// "protect the artist's price" mission blurb, which is separate marketing
// copy, not this statement.
//
// Split into two columns along the document's own seam: paragraphs 1-5 are
// the founding/origin narrative (left), paragraph 6 is the direct lead-in
// to "We strive to:" in the source, so it opens the right column with the
// commitments list and closing lines, exactly as the document orders them.
//
// Typography follows the rest of the About page: a pill label, a serif
// heading, sans-serif muted body copy, and gold kept for accents only.
const MISSION_STORY = [
  "GalleryZone was founded with a simple yet ambitious vision: to create a trusted platform where artists can showcase their creativity, reach more people, and build sustainable careers through their work.",
  "Across India and beyond, countless talented artists create remarkable works of art. However, many face challenges in gaining visibility, finding buyers, receiving fair value, and accessing professional opportunities. GalleryZone was established to help bridge that gap.",
  "Our mission is to connect artists, collectors, businesses, and display partners through a transparent, technology-driven ecosystem. By combining an online marketplace with curated physical display opportunities, we aim to make original art more accessible while helping artists expand their reach and recognition.",
  "At GalleryZone, we believe that every artwork tells a story, every artist deserves respect, and every customer deserves authenticity and confidence in their purchase. These principles guide every decision we make.",
  "As we grow, we remain committed to innovation, integrity, quality, and long-term partnerships. We will continue improving our platform, expanding our network, and creating opportunities that benefit artists, customers, and business partners alike.",
];

const MISSION_LEAD_BRAND = "GalleryZone";
const MISSION_LEAD_REST =
  " is committed to building a technology-driven platform that empowers artists, simplifies art discovery, and creates meaningful opportunities for buyers and business partners.";

const MISSION_COMMITMENTS: string[] = [
  "Support artists by providing greater visibility and market access.",
  "Offer customers authentic, high-quality artwork through a transparent purchasing experience.",
  "Build partnerships with businesses that showcase original art in commercial spaces.",
  "Deliver professional services covering artwork verification, logistics, documentation, and customer support.",
  "Promote sustainable growth within the art community through ethical business practices.",
];

const MISSION_CLOSING = [
  "Thank you for taking the time to learn about GalleryZone. We invite you to join us as we work to build a stronger and more connected future for the art community.",
  "Together, we can create opportunities, inspire creativity, and help original art reach more people than ever before.",
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const columnStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export function AboutMissionSection() {
  return (
    <section className="relative overflow-hidden py-14 sm:py-20 md:py-28">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT: origin story */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            variants={columnStagger}
          >
            <motion.div variants={fadeUp} transition={{ duration: 0.5, ease: "easeOut" }}>
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                Our Mission
              </span>
              <h2 className="mt-4 text-balance font-display text-3xl leading-[1.15] font-semibold sm:text-4xl">
                Welcome to <span className="text-gold-bright">GalleryZone.</span>
              </h2>
            </motion.div>

            <div className="mt-6 flex max-w-xl flex-col gap-4">
              {MISSION_STORY.map((paragraph, index) => (
                <motion.p
                  key={index}
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`text-balance leading-relaxed text-muted-foreground ${
                    index === 0 ? "text-lg" : "text-base"
                  }`}
                >
                  {paragraph}
                </motion.p>
              ))}
            </div>
          </motion.div>

          {/* RIGHT: commitments, in a card like the page's other panels */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            variants={columnStagger}
            className="self-start rounded-2xl border border-border bg-card p-6 sm:p-8"
          >
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-balance font-display text-xl leading-[1.4] font-medium tracking-tight text-foreground sm:text-2xl"
            >
              <span className="text-gold-bright">{MISSION_LEAD_BRAND}</span>
              {MISSION_LEAD_REST}
            </motion.p>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-8"
            >
              <p className="text-[11px] font-bold tracking-[0.2em] text-gold uppercase">
                We strive to
              </p>
              <ul className="mt-5 flex flex-col gap-4">
                {MISSION_COMMITMENTS.map((item) => (
                  <li key={item} className="flex items-start gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                      <Check className="size-4 text-gold-bright" strokeWidth={1.75} />
                    </span>
                    <p className="pt-1.5 text-base leading-relaxed text-muted-foreground">
                      {item}
                    </p>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Closing note, right after the commitments list */}
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mt-8 border-t border-border pt-6"
            >
              <div className="flex flex-col gap-3">
                {MISSION_CLOSING.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <p className="mt-5 font-display text-xl font-medium tracking-tight text-gold-bright">
                &ldquo;Connecting Artists with the World.&rdquo;
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
