import assert from "node:assert/strict";
import { shiprocketConfigFrom } from "./shiprocket.ts";

assert.equal(shiprocketConfigFrom({}), null, "empty configuration disables booking without creating demo tracking");

assert.throws(
  () => shiprocketConfigFrom({ SHIPROCKET_EMAIL: "ops@example.com" }),
  /must be set together/,
  "partial credentials must fail rather than create a stuck shipment",
);

const configured = shiprocketConfigFrom({
  SHIPROCKET_EMAIL: " ops@example.com ",
  SHIPROCKET_PASSWORD: "secret",
  SHIPROCKET_WEBHOOK_SECRET: "webhook-token",
  SHIPROCKET_BASE_URL: "https://courier.example/v1/",
  SHIPROCKET_PICKUP_LOCATION_NAME: " GalleryZone HQ ",
});
assert.deepEqual(configured, {
  email: "ops@example.com",
  password: "secret",
  webhookSecret: "webhook-token",
  baseUrl: "https://courier.example/v1",
  pickupLocationName: "GalleryZone HQ",
});

console.log("shiprocket config check passed");
