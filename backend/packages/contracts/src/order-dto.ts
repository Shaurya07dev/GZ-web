// Order/checkout request & response contracts. Validated with Zod
// (reject-unknown-keys, plan.md §14) before any handler touches the
// pricing/settlement engine.

import { z } from "zod";

export const createOrderInputSchema = z
  .object({
    artworkId: z.string().uuid(),
    addressId: z.string().uuid(),
    // Idempotency key the client generates once per checkout attempt —
    // required so a double-tapped "Pay now" button (or a retried request
    // after a flaky connection) never creates two orders. Enforced again
    // at the DB unique-constraint level on payments.idempotencyKey.
    idempotencyKey: z.string().min(16),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const orderStatusValues = [
  "pending",
  "paid",
  "confirmed",
  "packed",
  "transit",
  "delivered",
  "cancelled",
] as const;

export interface OrderDto {
  id: string;
  artworkId: string;
  status: (typeof orderStatusValues)[number];
  displayPricePaise: number;
  gstPaise: number;
  deliveryChargePaise: number;
  convenienceFeePaise: number;
  totalPaise: number;
  createdAt: string;
}

export const advanceOrderStatusInputSchema = z
  .object({
    orderId: z.string().uuid(),
    to: z.enum(orderStatusValues),
    // Required for "cancelled"; optional otherwise — validated at the
    // handler level against the specific transition, not here, since the
    // requirement is transition-dependent, not field-dependent.
    reason: z.string().optional(),
  })
  .strict();
