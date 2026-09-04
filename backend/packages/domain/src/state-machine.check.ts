// Run: node --experimental-strip-types packages/domain/src/state-machine.check.ts
//
// Illegal-transition test (plan.md §17 gate): for every state machine, every
// pair of states NOT listed as a valid transition must throw when asserted,
// and self-transitions (a->a) must never be silently legal unless explicitly
// listed (none are, by design — a transition is a change).

import assert from "node:assert/strict";
import {
  IllegalTransitionError,
  artworkStateMachine,
  connectionStateMachine,
  deactivationStateMachine,
  gstStateMachine,
  holdingStateMachine,
  insuranceStateMachine,
  kycStateMachine,
  orderStateMachine,
  penaltyStateMachine,
  physicalCoaStateMachine,
  resaleListingStateMachine,
  settlementStateMachine,
  shipmentStateMachine,
  transferStateMachine,
  withdrawalStateMachine,
  type StateMachine,
} from "./state-machine.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a heterogeneous
// list of StateMachine<S> for different S can't share one generic parameter;
// this function only ever touches the structural StateMachine shape, so
// erasing S here (rather than at every call site) is the narrowest possible
// escape hatch.
function checkMachine<S extends string>(machine: StateMachine<S | any>): void {
  const states = Object.keys(machine.transitions) as S[];
  for (const from of states) {
    // Every listed transition must be assertable without throwing.
    for (const to of machine.transitions[from]!) {
      assert.doesNotThrow(() => machine.assertTransition(from, to), `${machine.entity}: ${from} -> ${to} should be legal`);
    }
    // Every unlisted transition (including self) must throw.
    for (const to of states) {
      const listed = (machine.transitions[from] as readonly S[]).includes(to);
      if (!listed) {
        assert.throws(
          () => machine.assertTransition(from, to),
          IllegalTransitionError,
          `${machine.entity}: ${from} -> ${to} should be illegal`,
        );
      }
    }
  }
}

for (const machine of [
  artworkStateMachine,
  orderStateMachine,
  holdingStateMachine,
  shipmentStateMachine,
  kycStateMachine,
  gstStateMachine,
  insuranceStateMachine,
  withdrawalStateMachine,
  settlementStateMachine,
  deactivationStateMachine,
  penaltyStateMachine,
  transferStateMachine,
  physicalCoaStateMachine,
  resaleListingStateMachine,
  connectionStateMachine,
]) {
  checkMachine(machine);
}

console.log("packages/domain/state-machine.ts: all 15 machines pass the illegal-transition check");
