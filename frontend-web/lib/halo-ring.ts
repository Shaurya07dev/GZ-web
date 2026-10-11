// Slot angles for the halo reel (components/ui/halo-reel.tsx).
//
// Cards sit at slots round an ellipse. Equal angles crowd the cards where the
// ring runs vertical and strand them where it runs flat, so on a wide ring the
// gaps come out uneven. `ringAngles` can instead place the slots so every
// visible card is the same distance from its neighbours.

export const TAU = Math.PI * 2;

// Clearance kept between the outermost visible cards and the stage edge.
const EDGE_X = 28;
const EDGE_Y = 14;

export interface RingShape {
  slots: number;
  radiusX: number;
  radiusY: number;
  /** Front-card size in px. */
  cardW: number;
  cardH: number;
  /** Scale of a card at the far side of the ring. */
  minScale: number;
  stageW: number;
  stageH: number;
  centerXRatio: number;
  mirror: boolean;
}

export const scaleAt = (t: number, minScale: number) =>
  minScale + (1 - minScale) * ((Math.cos(t) + 1) / 2);

/**
 * Angles (radians, ascending from 0 = the front card) of the `slots` positions
 * round the ring. With `evenGaps`, the visible half is packed so neighbouring
 * cards are exactly the same distance apart, the last one sitting at the stage
 * edge; the gap is whatever makes that true, so it grows with the stage and
 * shrinks with the cards. Falls back to equal angles when there is no room.
 */
export function ringAngles(shape: RingShape, evenGaps: boolean): number[] {
  const { slots, radiusX, radiusY, cardW, cardH, minScale } = shape;
  const equal = Array.from({ length: slots }, (_, k) => (k * TAU) / slots);
  const K = Math.floor((slots - 1) / 2);
  if (!evenGaps || K < 1 || !radiusX || !radiusY) return equal;

  const sign = shape.mirror ? -1 : 1;

  // The last angle at which a card still sits wholly inside the stage.
  let end = 0;
  for (let t = 0.01; t <= Math.PI; t += 0.01) {
    const s = scaleAt(t, minScale);
    const x = shape.stageW * shape.centerXRatio + sign * Math.cos(t) * radiusX;
    const y = shape.stageH / 2 + Math.sin(t) * radiusY;
    const clear = shape.mirror ? shape.stageW - (x + (cardW * s) / 2) : x - (cardW * s) / 2;
    if (clear < EDGE_X || y + (cardH * s) / 2 > shape.stageH - EDGE_Y) break;
    end = t;
  }
  if (end < 0.2) return equal;

  // Box-to-box gap between a card at angle a and one at angle b.
  const gap = (a: number, b: number) => {
    const s = scaleAt(a, minScale) + scaleAt(b, minScale);
    return Math.max(
      Math.abs(radiusX * (Math.cos(b) - Math.cos(a))) - (cardW * s) / 2,
      Math.abs(radiusY * (Math.sin(b) - Math.sin(a))) - (cardH * s) / 2,
    );
  };

  // Walk out from the front, each card `g` clear of the last; null if K cards
  // don't fit before the edge.
  const walk = (g: number) => {
    const out = [0];
    for (let k = 0, t = 0; k < K; k++) {
      let n = t + 0.002;
      while (gap(t, n) < g) {
        n += 0.002;
        if (n > end) return null;
      }
      out.push((t = n));
    }
    return out;
  };

  // The widest gap at which K cards still fit, so the arc is used up evenly.
  let lo = -cardH * 0.6;
  let hi = cardH * 3;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (walk(mid)) lo = mid;
    else hi = mid;
  }
  const half = walk(lo);
  if (!half) return equal;
  half[K] = end;

  // An even slot count leaves one slot at the back of the ring, out of sight.
  return [
    ...half,
    ...(slots % 2 === 0 ? [Math.PI] : []),
    ...half.slice(1).reverse().map((t) => TAU - t),
  ];
}

/** Angle of ring position `p` (any real number), interpolating between slots. */
export function angleAt(angles: number[], p: number) {
  const n = angles.length;
  const q = ((p % n) + n) % n;
  const j = Math.floor(q);
  const next = j + 1 < n ? angles[j + 1] : angles[0] + TAU;
  return angles[j] + (q - j) * (next - angles[j]);
}

/** Inverse of `angleAt` for an angle in [0, TAU). */
export function positionAt(angles: number[], phi: number) {
  const n = angles.length;
  let j = n - 1;
  while (j > 0 && angles[j] > phi) j--;
  const next = j + 1 < n ? angles[j + 1] : angles[0] + TAU;
  return j + (phi - angles[j]) / (next - angles[j]);
}
