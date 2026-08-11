"use client";

import Image from "next/image";
import { motion, type MotionValue, useTransform } from "framer-motion";

export type ArtworkAnchor = {
  src: string;
  alt: string;
  /** Position as a percentage of the hero container, anchored at image center. */
  leftPct: number;
  topPct: number;
  width: number;
  height: number;
  /** Reveal progress window within the overall scroll timeline (0–1). */
  revealFrom: number;
  revealTo: number;
  /** Subtle rotation for a hand-placed, non-grid feel. */
  rotate: number;
};

export function HeroArtwork({
  artwork,
  progress,
}: {
  artwork: ArtworkAnchor;
  progress: MotionValue<number>;
}) {
  const { revealFrom, revealTo, rotate } = artwork;

  const opacity = useTransform(
    progress,
    [revealFrom, revealTo],
    [0, 1],
  );
  const scale = useTransform(
    progress,
    [revealFrom, revealTo],
    [0.75, 1],
  );
  const y = useTransform(progress, [revealFrom, revealTo], [28, 0]);

  return (
    <motion.div
      className="absolute rounded-sm shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] ring-1 ring-foreground/10"
      style={{
        left: `${artwork.leftPct}%`,
        top: `${artwork.topPct}%`,
        width: artwork.width,
        height: artwork.height,
        translateX: "-50%",
        translateY: "-50%",
        opacity,
        scale,
        y,
        rotate,
      }}
    >
      <Image
        src={artwork.src}
        alt={artwork.alt}
        fill
        sizes={`${artwork.width}px`}
        className="rounded-sm object-cover"
        priority
      />
    </motion.div>
  );
}
