"use client";

import "@/lib/motion-config";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useSpring } from "framer-motion";
import { HeroArtwork, type ArtworkAnchor } from "./hero-artwork";

const ARTWORKS: ArtworkAnchor[] = [
  {
    src: "/artworks/bird.png",
    alt: "Mixed-media still life with a bird",
    leftPct: 12,
    topPct: 32,
    width: 126,
    height: 126,
    revealFrom: 0.04,
    revealTo: 0.3,
    rotate: -3,
  },
  {
    src: "/artworks/eye-pyramid.png",
    alt: "Graphite illustration of an eye within a pyramid",
    leftPct: 12.5,
    topPct: 71,
    width: 196,
    height: 196,
    revealFrom: 0.12,
    revealTo: 0.38,
    rotate: 2,
  },
  {
    src: "/artworks/draped-figure.png",
    alt: "Illustration of a draped figure",
    leftPct: 78,
    topPct: 39,
    width: 128,
    height: 178,
    revealFrom: 0.2,
    revealTo: 0.46,
    rotate: 3,
  },
  {
    src: "/artworks/landscape.png",
    alt: "Sepia landscape painting",
    leftPct: 89,
    topPct: 27,
    width: 128,
    height: 142,
    revealFrom: 0.28,
    revealTo: 0.54,
    rotate: -2,
  },
  {
    src: "/artworks/collage-busts.png",
    alt: "Abstract collage of sculptural busts",
    leftPct: 86,
    topPct: 63,
    width: 176,
    height: 170,
    revealFrom: 0.36,
    revealTo: 0.62,
    rotate: 2,
  },
  {
    src: "/artworks/portrait-woman.png",
    alt: "Portrait painting of a woman",
    leftPct: 19,
    topPct: 87,
    width: 138,
    height: 102,
    revealFrom: 0.44,
    revealTo: 0.7,
    rotate: -2,
  },
  {
    src: "/artworks/framed-painting.png",
    alt: "Framed painting with a maroon mat",
    leftPct: 75,
    topPct: 82,
    width: 136,
    height: 150,
    revealFrom: 0.52,
    revealTo: 0.78,
    rotate: 3,
  },
  {
    src: "/identity/identity-card.png",
    alt: "Vintage artwork photograph with a digital ID tag",
    leftPct: 25,
    topPct: 14,
    width: 118,
    height: 140,
    revealFrom: 0.6,
    revealTo: 0.86,
    rotate: -2,
  },
  {
    src: "/identity/certificate-card.png",
    alt: "Certificate of authenticity document",
    leftPct: 91,
    topPct: 52,
    width: 134,
    height: 134,
    revealFrom: 0.68,
    revealTo: 0.94,
    rotate: 2,
  },
];

export function HeroSection() {
  const driverRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: driverRef,
    offset: ["start start", "end end"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    mass: 0.4,
  });

  return (
    <section ref={driverRef} className="relative h-[300vh]">
      <div className="sticky top-20 flex h-[calc(100vh-5rem)] w-full flex-col items-center justify-center overflow-hidden">
        {ARTWORKS.map((artwork) => (
          <HeroArtwork
            key={artwork.src}
            artwork={artwork}
            progress={smoothProgress}
          />
        ))}

        <motion.div
          className="relative z-10 flex max-w-2xl flex-col items-center px-6 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h1 className="text-balance font-display text-5xl leading-[1.1] font-semibold sm:text-6xl">
            Your Art
            <br />
            Deserves an{" "}
            <span className="bg-gradient-to-r from-gold-deep via-gold to-gold-bright bg-clip-text italic text-transparent">
              Identity.
            </span>
          </h1>
          <p className="mt-6 max-w-md text-balance text-base text-muted-foreground">
            A trusted digital ecosystem for original artwork, artists and
            collectors.
          </p>
          <Link
            href="/marketplace"
            className="group mt-9 inline-flex items-center gap-2 rounded-md border border-gold/60 px-6 py-3 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
          >
            Explore GalleryZone
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
