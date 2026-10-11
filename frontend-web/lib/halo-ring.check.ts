// Run: node --experimental-strip-types lib/halo-ring.check.ts
//
// The marketplace hero's reel must keep an even gap between paintings on a wide
// ring and never push one past the stage edge. Recomputes the card boxes from
// the slot angles rather than trusting ringAngles' own bookkeeping.

import assert from "node:assert/strict";
import { TAU, angleAt, positionAt, ringAngles, scaleAt, type RingShape } from "./halo-ring.ts";

// The hero's two reels (features/marketplace/marketplace-hero.tsx) at a stage
// each is actually shown at: xl is a 1536px screen, lg a 1100px one.
const xl: RingShape = {
  slots: 6,
  stageW: 799,
  stageH: 660,
  radiusX: 0.68 * 799,
  radiusY: 0.34 * 660,
  cardW: 166, // 170 × the 0.98 the stage scales cards by
  cardH: 222,
  minScale: 0.65,
  centerXRatio: 0.9,
  mirror: true,
};
const lg: RingShape = {
  ...xl,
  stageW: 572,
  radiusX: 0.38 * 572,
  radiusY: 0.36 * 660,
  cardW: 120,
  cardH: 160,
  minScale: 0.6,
  centerXRatio: 0.86,
};

for (const [name, hero] of [["xl", xl], ["lg", lg]] as const) {
  const N = hero.slots;
  const K = (N - 2) / 2;

  // Equal angles are the default and the fallback.
  const equal = ringAngles(hero, false);
  assert.equal(equal.length, N);
  assert.ok(equal.every((a, k) => Math.abs(a - (k * TAU) / N) < 1e-12));
  assert.deepEqual(ringAngles({ ...hero, radiusX: 0 }, true), equal, "no measured stage yet");
  assert.deepEqual(ringAngles({ ...hero, slots: 2 }, true), ringAngles({ ...hero, slots: 2 }, false));

  // Packed ring: ascending, symmetric about the front, one hidden slot at the back.
  const angles = ringAngles(hero, true);
  assert.equal(angles.length, N);
  assert.equal(angles[0], 0);
  assert.equal(angles[N / 2], Math.PI);
  for (let k = 1; k < N; k++) {
    assert.ok(angles[k] > angles[k - 1], `${name}: ascending`);
    if (k !== N / 2) assert.ok(Math.abs(angles[k] + angles[N - k] - TAU) < 1e-9, `${name}: symmetric`);
  }

  // Boxes of the visible cards (front plus K per side), top to bottom.
  const box = (t: number) => {
    const s = scaleAt(t, hero.minScale);
    return {
      x: hero.stageW * hero.centerXRatio - Math.cos(t) * hero.radiusX,
      y: hero.stageH / 2 + Math.sin(t) * hero.radiusY,
      w: hero.cardW * s,
      h: hero.cardH * s,
    };
  };
  const order = [
    ...Array.from({ length: K }, (_, i) => angles[N - K + i]),
    angles[0],
    ...Array.from({ length: K }, (_, i) => angles[1 + i]),
  ];
  const visible = order.map(box);
  const gaps = visible.slice(1).map((b, i) => {
    const a = visible[i];
    return Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.y - b.y) - (a.h + b.h) / 2);
  });
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1.5, `${name}: gaps are even, got ${gaps.map((g) => g.toFixed(1))}`);
  assert.ok(Math.min(...gaps) > 20, `${name}: paintings have air between them`);

  for (const c of visible) {
    assert.ok(c.x + c.w / 2 <= hero.stageW - 28 + 1e-6, `${name}: inside the right edge`);
    assert.ok(c.y - c.h / 2 >= 14 - 1e-6 && c.y + c.h / 2 <= hero.stageH - 14 + 1e-6, `${name}: inside top and bottom`);
  }
  const hidden = box(angles[N / 2]);
  assert.ok(hidden.x - hidden.w / 2 >= hero.stageW, `${name}: the spare card waits off-stage`);

  // angleAt / positionAt are inverses, wrap for any ring position, and pass through the slots.
  for (let k = 0; k < N; k++) assert.ok(Math.abs(angleAt(angles, k) - angles[k]) < 1e-12);
  for (const p of [0.3, 1.5, 3.9, 5.2, N - 0.01]) {
    assert.ok(Math.abs(positionAt(angles, angleAt(angles, p)) - p) < 1e-9, `${name}: round trip ${p}`);
    assert.ok(Math.abs(angleAt(angles, p + N) - angleAt(angles, p)) < 1e-12, `${name}: wraps`);
    assert.ok(Math.abs(angleAt(angles, p - 2 * N) - angleAt(angles, p)) < 1e-12, `${name}: wraps backwards`);
  }

  console.log(`halo-ring ${name}: ok  gaps`, gaps.map((g) => g.toFixed(0)).join(", "));
}

// Tiny stage: no room for the cards, so it degrades to equal angles instead of NaN.
const cramped = ringAngles({ ...xl, stageW: 120, stageH: 120, radiusX: 80, radiusY: 40 }, true);
assert.ok(cramped.every(Number.isFinite));
