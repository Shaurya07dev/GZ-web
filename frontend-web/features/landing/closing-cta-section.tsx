"use client";

import "@/lib/motion-config";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, Fingerprint, Globe, Lock, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Verified Authenticity",
    description: "Every artwork is carefully verified.",
  },
  {
    icon: Fingerprint,
    title: "Permanent Digital Identity",
    description: "A unique identity that lasts forever.",
  },
  {
    icon: Globe,
    title: "Global Exposure",
    description: "Reach collectors worldwide.",
  },
  {
    icon: Lock,
    title: "100% Price Privacy",
    description: "Your listed price always stays confidential.",
  },
];

export function ClosingCtaSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-gold/25 bg-card"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
            <div className="px-8 py-10 md:px-12 md:py-12">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-2xl font-semibold text-gold-bright italic">
                  GZ
                </span>
                <span className="text-sm font-medium tracking-[0.18em] text-foreground">
                  GALLERYZONE
                </span>
              </div>

              <h2 className="mt-6 text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
                Give your art
                <br />
                an{" "}
                <span className="bg-gradient-to-r from-gold-deep via-gold to-gold-bright bg-clip-text text-transparent">
                  identity.
                </span>
              </h2>

              <p className="mt-4 max-w-md text-balance text-base leading-relaxed text-muted-foreground">
                Join GalleryZone and give your original artwork the
                identity, recognition, and visibility it deserves.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {FEATURES.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
                      <feature.icon
                        className="size-4 text-gold-bright"
                        strokeWidth={1.75}
                      />
                    </span>
                    <div>
                      <h3 className="text-sm font-medium text-foreground">
                        {feature.title}
                      </h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden px-8 pb-14 lg:min-h-0 lg:pb-0">
              <OrbitRings />
              <Link
                href="/register?role=artist"
                className="group relative z-10 inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-gold-bright to-gold px-12 py-7 text-lg font-semibold text-[#171310] shadow-[0_28px_70px_-14px_rgba(200,154,74,0.65)] transition-transform hover:scale-[1.02]"
              >
                Become an Early Artist
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function OrbitRings() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      aria-hidden
    >
      <div className="absolute size-[340px] rounded-full bg-gold/25 blur-[80px]" />
      <svg viewBox="0 0 600 600" className="absolute size-[520px] shrink-0">
        <circle
          cx="300"
          cy="300"
          r="220"
          fill="none"
          stroke="var(--gold)"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        <circle
          cx="300"
          cy="300"
          r="280"
          fill="none"
          stroke="var(--gold)"
          strokeOpacity="0.2"
          strokeWidth="1"
        />
        <circle cx="440" cy="58" r="4" fill="var(--gold-bright)" />
        <circle cx="93" cy="375" r="3" fill="var(--gold)" fillOpacity="0.7" />
      </svg>
    </div>
  );
}
