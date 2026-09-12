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
    leftPct: 15,
    topPct: 75,
    width: 196,
    height: 196,
    revealFrom: 0.12,
    revealTo: 0.38,
    rotate: 2,
  },
  {
    src: "/artworks/draped-figure.png",
    alt: "Illustration of a draped figure",
    leftPct: 85,
    topPct: 40,
    width: 128,
    height: 178,
    revealFrom: 0.2,
    revealTo: 0.46,
    rotate: 3,
  },
  {
    src: "/artworks/landscape.png",
    alt: "Sepia landscape painting",
    leftPct: 75,
    topPct: 15,
    width: 128,
    height: 142,
    revealFrom: 0.28,
    revealTo: 0.54,
    rotate: -2,
  },
  {
    src: "/artworks/collage-busts.png",
    alt: "Abstract collage of sculptural busts",
    leftPct: 85,
    topPct: 75,
    width: 176,
    height: 170,
    revealFrom: 0.36,
    revealTo: 0.62,
    rotate: 2,
  },
  {
    src: "/artworks/portrait-woman.png",
    alt: "Portrait painting of a woman",
    leftPct: 35,
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
    leftPct: 65,
    topPct: 87,
    width: 136,
    height: 150,
    revealFrom: 0.52,
    revealTo: 0.78,
    rotate: 3,
  },
  {
    src: "/artworks/hero-original-art.png",
    alt: "Original contemporary still-life painting",
    leftPct: 30,
    topPct: 14,
    width: 118,
    height: 140,
    revealFrom: 0.6,
    revealTo: 0.86,
    rotate: -2,
  },
];

// A separate, sparse set for mobile/tablet: four images pinned to the actual
// screen corners, well clear of the centered headline band, instead of
// naively shrinking the desktop scatter (which just pulls every image
// inward toward the center and piles them on top of the text).
const MOBILE_ARTWORKS: ArtworkAnchor[] = [
  {
    src: "/artworks/bird.png",
    alt: "Mixed-media still life with a bird",
    leftPct: 14,
    topPct: 24,
    width: 84,
    height: 84,
    revealFrom: 0.05,
    revealTo: 0.3,
    rotate: -3,
  },
  {
    src: "/artworks/eye-pyramid.png",
    alt: "Graphite illustration of an eye within a pyramid",
    leftPct: 84,
    topPct: 15,
    width: 96,
    height: 96,
    revealFrom: 0.18,
    revealTo: 0.42,
    rotate: 3,
  },
  {
    src: "/artworks/framed-painting.png",
    alt: "Framed painting with a maroon mat",
    leftPct: 20,
    topPct: 82,
    width: 88,
    height: 96,
    revealFrom: 0.32,
    revealTo: 0.56,
    rotate: -2,
  },
  {
    src: "/artworks/portrait-woman.png",
    alt: "Portrait painting of a woman",
    leftPct: 82,
    topPct: 92,
    width: 96,
    height: 70,
    revealFrom: 0.46,
    revealTo: 0.7,
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
      <div className="sticky top-20 flex h-[calc(100dvh-9rem)] w-full flex-col items-center justify-center overflow-hidden lg:h-[calc(100dvh-5rem)]">
        <div className="absolute inset-0 hidden lg:block">
          {ARTWORKS.map((artwork) => (
            <HeroArtwork
              key={artwork.src}
              artwork={artwork}
              progress={smoothProgress}
            />
          ))}
        </div>
        <div className="absolute inset-0 lg:hidden">
          {MOBILE_ARTWORKS.map((artwork) => (
            <HeroArtwork
              key={artwork.src}
              artwork={artwork}
              progress={smoothProgress}
            />
          ))}
        </div>

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
