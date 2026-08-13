"use client";
import React, { SVGProps, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { cn } from "@/lib/utils";

// Adapted from the Aceternity-style StickyBanner reference: this project's
// installed framer-motion (13.x) has no "motion/react" submodule, only the
// root export, so that import is swapped for "framer-motion" everywhere in
// this codebase (see switch-mode.tsx, login-form.tsx, etc.).
//
// Also fixes two real bugs in the source:
// 1. Its scroll handler called `setOpen(true)` unconditionally whenever
//    `hideOnScroll` was false, which silently re-opened the banner on the
//    very next scroll tick after a user clicked the close button.
// 2. It only ever animated `y`/`opacity` (a transform), which doesn't
//    remove the element from layout — so hiding on scroll left its
//    `min-h-14` box still reserving space, showing up as a dead gap above
//    whatever sticky header sits below it. The banner now unmounts (via
//    AnimatePresence) whenever it's not visible for ANY reason —
//    dismissed OR scrolled past — so the layout actually collapses once
//    the hide transition finishes, not just visually fades.
export const StickyBanner = ({
  className,
  children,
  hideOnScroll = false,
  onDismiss,
}: {
  className?: string;
  children: React.ReactNode;
  hideOnScroll?: boolean;
  onDismiss?: () => void;
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [scrolledPast, setScrolledPast] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (hideOnScroll) setScrolledPast(latest > 40);
  });

  const visible = !dismissed && !(hideOnScroll && scrolledPast);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn(
            "sticky inset-x-0 top-0 z-40 flex min-h-14 w-full items-center justify-center bg-transparent px-4 py-1",
            className,
          )}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {children}

          <motion.button
            type="button"
            aria-label="Dismiss"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer"
            onClick={() => {
              setDismissed(true);
              onDismiss?.();
            }}
          >
            <CloseIcon className="h-5 w-5 text-current" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const CloseIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  );
};
