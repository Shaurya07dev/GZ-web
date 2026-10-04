// The paise <-> rupee boundary is the one place a factor-of-100 bug turns into
// money moving wrongly, so it gets its own check: known values, the awkward
// floating-point cases, the refusals, and a round-trip over a wide range.

import assert from "node:assert/strict";
import { GatewayAmountError, gatewayAmountMatches, gatewayAmountToPaise, paiseToGatewayAmount } from "./gateway-money.ts";

// Known amounts, including real listing prices from this codebase.
assert.equal(paiseToGatewayAmount(0), "0.00");
assert.equal(paiseToGatewayAmount(1), "0.01");
assert.equal(paiseToGatewayAmount(10), "0.10");
assert.equal(paiseToGatewayAmount(99), "0.99");
assert.equal(paiseToGatewayAmount(100), "1.00");
assert.equal(paiseToGatewayAmount(4_500_000), "45000.00");
assert.equal(paiseToGatewayAmount(50_000), "500.00");

// The cases that make `paise / 100` the wrong implementation: in binary64
// 2_010_020 / 100 is 20100.199999999997, and 2_010_005 / 100 is 20100.05
// only by luck. Integer arithmetic has to give the exact string.
assert.equal(paiseToGatewayAmount(2_010_020), "20100.20");
assert.equal(paiseToGatewayAmount(2_010_005), "20100.05");
assert.equal(paiseToGatewayAmount(70_007), "700.07");
assert.equal(paiseToGatewayAmount(8_200_003), "82000.03");

// Nothing fractional, negative or unsafe gets past the boundary.
assert.throws(() => paiseToGatewayAmount(10.5), GatewayAmountError);
assert.throws(() => paiseToGatewayAmount(-1), GatewayAmountError);
assert.throws(() => paiseToGatewayAmount(Number.NaN), GatewayAmountError);
assert.throws(() => paiseToGatewayAmount(Number.MAX_SAFE_INTEGER + 2), GatewayAmountError);

// Coming back the other way, from either a JSON number or a string.
assert.equal(gatewayAmountToPaise("45000.00"), 4_500_000);
assert.equal(gatewayAmountToPaise(45000), 4_500_000);
assert.equal(gatewayAmountToPaise(45000.5), 4_500_050);
assert.equal(gatewayAmountToPaise("0.01"), 1);
assert.equal(gatewayAmountToPaise("700.7"), 70_070);
assert.equal(gatewayAmountToPaise("700"), 70_000);

// Sub-paise precision is refused rather than rounded: if Cashfree ever reports
// an amount we cannot represent, that is a reconciliation problem.
assert.throws(() => gatewayAmountToPaise("100.005"), GatewayAmountError);
assert.throws(() => gatewayAmountToPaise("-5.00"), GatewayAmountError);
assert.throws(() => gatewayAmountToPaise("1e3"), GatewayAmountError);
assert.throws(() => gatewayAmountToPaise(""), GatewayAmountError);
assert.throws(() => gatewayAmountToPaise("abc"), GatewayAmountError);
assert.throws(() => gatewayAmountToPaise(Number.POSITIVE_INFINITY), GatewayAmountError);

// The amount guard that stands between a webhook and a settled order.
assert.equal(gatewayAmountMatches(4_500_000, "45000.00"), true);
assert.equal(gatewayAmountMatches(4_500_000, 45000), true);
// The exact shape of the bug this guard exists to catch: rupees read as paise.
assert.equal(gatewayAmountMatches(4_500_000, "450000.00"), false);
assert.equal(gatewayAmountMatches(4_500_000, "450.00"), false);
assert.equal(gatewayAmountMatches(4_500_000, "44999.99"), false);
assert.equal(gatewayAmountMatches(4_500_000, "garbage"), false);

// Round-trip: every paise value in a wide sweep survives both directions.
for (let paise = 0; paise <= 2_000_000; paise += 7) {
  assert.equal(gatewayAmountToPaise(paiseToGatewayAmount(paise)), paise, `round trip failed at ${paise} paise`);
}
// And the awkward tail of each rupee, where the remainder padding matters.
for (let rupees = 0; rupees < 5000; rupees++) {
  for (const remainder of [0, 1, 9, 10, 99]) {
    const paise = rupees * 100 + remainder;
    assert.equal(gatewayAmountToPaise(paiseToGatewayAmount(paise)), paise, `round trip failed at ${paise} paise`);
  }
}

console.log("packages/domain/gateway-money.ts: paise <-> rupee conversion, refusals and round-trip all hold");
