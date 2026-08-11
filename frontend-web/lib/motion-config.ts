import { supportsFlags } from "motion-dom";

/**
 * Force Motion's scroll-linked animations through the standard JS-tracked
 * path instead of native CSS ScrollTimeline/ViewTimeline. The native path
 * (auto-enabled when the browser supports it) produced incorrect computed
 * styles for multi-consumer useTransform chains in this app — the
 * JS-driven scrollYProgress value itself stayed correct, but derived
 * opacity/scale/y transforms silently reset instead of holding at their
 * clamped end value once scroll passed a reveal window.
 */
supportsFlags.viewTimeline = false;
supportsFlags.scrollTimeline = false;
