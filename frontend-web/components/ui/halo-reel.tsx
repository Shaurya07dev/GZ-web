"use client";

import * as React from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { angleAt, positionAt, ringAngles, TAU } from "@/lib/halo-ring";
import { cn } from "@/lib/utils";

/* ── Halo Reel ───────────────────────────────────────────────────
 * Cards ride an ellipse. Card i sits at slot i + rotation; a slot has an angle
 * θ, and on an ellipse of radii (rx, ry):
 *
 *   x = ±rx·cos θ     y = ry·sin θ     scale = min + (1−min)·(cos θ + 1)/2
 *
 * cos θ does all the work: it places the card, sizes it, and — through the
 * scale — stacks it, so a card that looks nearer *is* nearer.
 *
 * One `rotation` motion value (in slots) drives the whole ring. Every card
 * derives its transform from it through `useTransform`, so a spin never
 * re-renders React.
 *
 * `mirror` flips the ring left-to-right: pair it with `centerXRatio` near 1 to
 * pin the ellipse to the right edge so the visible arc bulges toward the middle.
 * `evenGaps` spaces the slots so the visible cards sit the same distance apart
 * (see lib/halo-ring.ts).
 * ─────────────────────────────────────────────────────────────── */

export type HaloReelItem = {
  /** Image for the card. Omit it and the card falls back to the text face. */
  src?: string;
  alt?: string;
  bgColor?: string;
  textColor?: string;
  title?: string;
  subtitle?: string;
};

export interface HaloReelProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  items: HaloReelItem[];
  /** Card width in px at the front of the ring. @default 130 */
  cardWidth?: number;
  /** Card height in px at the front of the ring. @default 180 */
  cardHeight?: number;
  /** Scale of the card at the far side of the ring. @default 0.4 */
  minScale?: number;
  /** Horizontal radius as a fraction of the stage width. @default 0.45 */
  radiusXRatio?: number;
  /** Where the ellipse is centred across the stage. `0` pins it to the left
   *  edge, `1` to the right; the far half of the ring is clipped away.
   *  @default 0 */
  centerXRatio?: number;
  /** Flip the ring so the front of the arc faces left. @default false */
  mirror?: boolean;
  /** Space the cards so every visible one is the same distance from its
   *  neighbours, whatever shape the ring is. Needs 3+ slots; set `maxCards` to
   *  the number of items so no painting repeats. The gap is whatever fills the
   *  arc: smaller cards, more air. @default false */
  evenGaps?: boolean;
  /** Vertical radius as a fraction of the stage height. @default 0.36 */
  radiusYRatio?: number;
  /** Rotate one card forward on a timer. @default true */
  autoPlay?: boolean;
  /** Time (ms) a card is held at the front before the next step. @default 1000 */
  holdDuration?: number;
  /** Duration (ms) of one step. @default 700 */
  stepDuration?: number;
  /** Hold the autoplay while a pointer rests on a card. @default true */
  pauseOnHover?: boolean;
  /** Spin the ring by dragging it. @default true */
  draggable?: boolean;
  /** Gap between neighbouring cards at the widest point of the ring, in card
   *  widths. The ring repeats `items` until it holds this spacing.
   *  @default 1.2 */
  spread?: number;
  /** Ceiling on the number of cards drawn around the ring. @default 64 */
  maxCards?: number;
  /** Multiplier on the drag rotation. @default 1 */
  dragSensitivity?: number;
  /** Node parked in the middle of the ring, behind the cards. */
  centerLabel?: React.ReactNode;
  /** @default true */
  showCenterLabel?: boolean;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export function HaloReel({
  items,
  cardWidth = 130,
  cardHeight = 180,
  minScale = 0.4,
  radiusXRatio = 0.45,
  centerXRatio = 0,
  mirror = false,
  evenGaps = false,
  radiusYRatio = 0.36,
  autoPlay = true,
  holdDuration = 1000,
  stepDuration = 700,
  pauseOnHover = true,
  draggable = true,
  spread = 1.2,
  maxCards = 64,
  dragSensitivity = 1,
  centerLabel,
  showCenterLabel = true,
  className,
  style,
  ...props
}: HaloReelProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const count = items.length;
  const sign = mirror ? -1 : 1;

  const rotation = useMotionValue(0);
  const draggingRef = React.useRef(false);
  const hoverRef = React.useRef(false);

  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () =>
      setSize({ w: node.offsetWidth, h: node.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const radiusX = size.w * radiusXRatio;
  const radiusY = size.h * radiusYRatio;

  // The ring is sized by the stage and *filled* by repeating the items.
  const slots = clamp(
    Math.ceil(
      TAU *
        Math.max(
          radiusX / (cardWidth * spread),
          radiusY / (cardHeight * spread),
        ),
    ),
    count,
    Math.max(count, maxCards),
  );

  // Cards shrink continuously to fit the box instead of stepping at a breakpoint.
  const fit = size.w
    ? clamp(
        Math.min(
          size.w / (radiusX + cardWidth),
          size.h / (2 * radiusY + cardHeight),
        ),
        0.45,
        1,
      )
    : 1;
  const cardW = cardWidth * fit;
  const cardH = cardHeight * fit;

  // Where each slot sits round the ring, as an angle.
  const angles = React.useMemo(
    () =>
      ringAngles(
        {
          slots,
          radiusX,
          radiusY,
          cardW,
          cardH,
          minScale,
          stageW: size.w,
          stageH: size.h,
          centerXRatio,
          mirror,
        },
        evenGaps,
      ),
    [slots, radiusX, radiusY, cardW, cardH, minScale, size.w, size.h, centerXRatio, mirror, evenGaps],
  );

  // Autoplay. Each step schedules the next, so a paused tick costs a re-check.
  React.useEffect(() => {
    if (!autoPlay || reduceMotion || !count) return;

    let timer = 0;
    let controls: ReturnType<typeof animate> | undefined;

    const tick = () => {
      timer = window.setTimeout(() => {
        if (draggingRef.current || (pauseOnHover && hoverRef.current)) {
          tick();
          return;
        }
        controls = animate(rotation, rotation.get() - 1, {
          duration: stepDuration / 1000,
          ease: [0.4, 0, 0.2, 1],
          onComplete: tick,
        });
      }, holdDuration);
    };

    tick();
    return () => {
      window.clearTimeout(timer);
      controls?.stop();
    };
  }, [
    autoPlay,
    count,
    holdDuration,
    pauseOnHover,
    reduceMotion,
    rotation,
    stepDuration,
  ]);

  /* ── drag ──────────────────────────────────────────────────── */

  const dragRef = React.useRef({ left: 0, top: 0, pos: 0 });

  // Ring position under the pointer. Normalising by the radii un-squashes the
  // ellipse and the sign un-mirrors it, so this is the card's own angle.
  const pointerPos = (e: React.PointerEvent) => {
    const { left, top } = dragRef.current;
    const phi = Math.atan2(
      (e.clientY - top - size.h / 2) / (radiusY || 1),
      (sign * (e.clientX - left - size.w * centerXRatio)) / (radiusX || 1),
    );
    return positionAt(angles, (phi + TAU) % TAU);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || (e.pointerType === "mouse" && e.button !== 0)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { left: rect.left, top: rect.top, pos: 0 };
    dragRef.current.pos = pointerPos(e);
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const pos = pointerPos(e);
    const n = angles.length;
    // Wrap into [−n/2, n/2) so crossing the seam is one small delta.
    const delta = ((pos - dragRef.current.pos + n * 1.5) % n) - n / 2;
    dragRef.current.pos = pos;
    rotation.set(rotation.get() + delta * dragSensitivity);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // Settle onto the nearest card — the ring never rests between two.
    const snapped = Math.round(rotation.get());
    if (reduceMotion) {
      rotation.set(snapped);
      return;
    }
    animate(rotation, snapped, { duration: 0.5, ease: [0.16, 1, 0.3, 1] });
  };

  const spinBy = (direction: number) => {
    const target = Math.round(rotation.get()) - direction;
    if (reduceMotion) {
      rotation.set(target);
      return;
    }
    animate(rotation, target, {
      duration: stepDuration / 1000,
      ease: [0.4, 0, 0.2, 1],
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const direction = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!direction) return;
    e.preventDefault();
    spinBy(direction);
  };

  if (!count) return null;

  // The space the ring leaves free, on the side away from the arc.
  const labelInset = mirror
    ? { left: 0, right: size.w * (1 - centerXRatio) + radiusX + cardW / 2 }
    : { left: size.w * centerXRatio + radiusX + cardW / 2, right: 0 };

  return (
    <div
      ref={stageRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={props["aria-label"] ?? "Image carousel"}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        "relative h-[100dvh] w-full touch-pan-y select-none overflow-hidden outline-none",
        draggable && "cursor-grab active:cursor-grabbing",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
      style={style}
      {...props}
    >
      {showCenterLabel && centerLabel ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-0 flex items-center justify-center px-4 text-center"
          style={labelInset}
        >
          {centerLabel}
        </div>
      ) : null}

      {Array.from({ length: slots }, (_, i) => (
        <WheelCard
          key={i}
          item={items[i % count]}
          // Only the first lap is real content; the copies are decoration.
          decorative={i >= count}
          index={i}
          angles={angles}
          rotation={rotation}
          radiusX={radiusX}
          radiusY={radiusY}
          sign={sign}
          centerXRatio={centerXRatio}
          minScale={minScale}
          width={cardW}
          height={cardH}
          onHoverChange={(hovered) => {
            hoverRef.current = hovered;
          }}
        />
      ))}
    </div>
  );
}

/* ── card ────────────────────────────────────────────────────── */

function WheelCard({
  item,
  index,
  angles,
  rotation,
  radiusX,
  radiusY,
  sign,
  centerXRatio,
  minScale,
  width,
  height,
  decorative,
  onHoverChange,
}: {
  item: HaloReelItem;
  index: number;
  angles: number[];
  rotation: MotionValue<number>;
  radiusX: number;
  radiusY: number;
  sign: number;
  centerXRatio: number;
  minScale: number;
  width: number;
  height: number;
  decorative: boolean;
  onHoverChange: (hovered: boolean) => void;
}) {
  const theta = useTransform(rotation, (r) => angleAt(angles, index + r));
  const cos = useTransform(theta, Math.cos);
  const sin = useTransform(theta, Math.sin);

  const x = useTransform(cos, (c) => sign * c * radiusX);
  const y = useTransform(sin, (s) => s * radiusY);
  const scale = useTransform(
    cos,
    (c) => minScale + (1 - minScale) * ((c + 1) / 2),
  );
  const zIndex = useTransform(scale, (s) => Math.round(s * 1000));

  return (
    <motion.div
      role={decorative ? undefined : "group"}
      aria-roledescription={decorative ? undefined : "slide"}
      aria-hidden={decorative || undefined}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      style={{
        x,
        y,
        scale,
        zIndex,
        width,
        height,
        left: `${centerXRatio * 100}%`,
        top: "50%",
        marginLeft: -width / 2,
        marginTop: -height / 2,
      }}
      className="absolute overflow-hidden rounded-xl shadow-[0_24px_40px_-18px_rgb(0_0_0/0.7)] ring-1 ring-white/10"
    >
      {item.src ? (
        <img
          src={item.src}
          alt={decorative ? "" : (item.alt ?? "")}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1 bg-card p-3 text-center text-card-foreground"
          style={{
            backgroundColor: item.bgColor,
            color: item.textColor,
          }}
        >
          {item.title ? (
            <span className="text-2xl font-black leading-none">
              {item.title}
            </span>
          ) : null}
          {item.subtitle ? (
            <span className="text-[0.6rem] uppercase tracking-[0.2em] opacity-70">
              {item.subtitle}
            </span>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}

export default HaloReel;
