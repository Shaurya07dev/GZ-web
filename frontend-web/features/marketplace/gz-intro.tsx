"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// How long the mark stays before it lifts away (the fade-in and exit run
// inside this window and just after it).
const SHOW_MS = 3400;

// The sweep of light is clipped to the logo's own shape, so it crosses the
// letters and the map, not the empty space around them.
const LOGO_MASK = {
  maskImage: "url(/brand/gz-logo.png)",
  WebkitMaskImage: "url(/brand/gz-logo.png)",
  maskSize: "100% 100%",
  WebkitMaskSize: "100% 100%",
} as const;

/**
 * The GalleryZone mark, shown for a few seconds in the empty middle of the
 * reel each time the marketplace opens: it fades up, a gold glow and a sweep of
 * light pass over it, then it lifts away and the page is as normal.
 * Skipped entirely for visitors who ask for reduced motion.
 *
 * There is no card behind it: the PNG is transparent, so the G reads as a fine
 * outline on the dark hero and as solid black on the light one.
 */
export function GzIntro() {
  const reduceMotion = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (reduceMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-[76%] z-10 -translate-x-1/2 -translate-y-1/2"
    >
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 16, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              scale: 1.12,
              filter: "blur(10px)",
              transition: { duration: 0.6, ease: [0.4, 0, 1, 1] },
            }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-44 xl:w-64"
          >
            <motion.span
              initial={{ opacity: 0.8, scale: 0.7 }}
              animate={{ opacity: 0, scale: 1.6 }}
              transition={{ delay: 0.4, duration: 1.6, ease: "easeOut" }}
              className="absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--gold-bright)_35%,transparent),transparent)]"
            />
            <Image
              src="/brand/gz-logo.png"
              alt=""
              width={822}
              height={560}
              sizes="256px"
              className="relative h-auto w-full"
            />
            <div style={LOGO_MASK} className="absolute inset-0 overflow-hidden">
              <motion.span
                initial={{ x: "0%" }}
                animate={{ x: "420%" }}
                transition={{ delay: 0.8, duration: 1.1, ease: "easeInOut" }}
                className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/60 to-transparent"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
