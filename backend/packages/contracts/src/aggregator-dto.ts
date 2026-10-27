// Aggregator/consignment request contracts — reserve, recordSale, release,
// ask to keep a piece, and GalleryZone's answer.

import { z } from "zod";
import { WALLET_TOPUP_MAX_PAISE, WALLET_TOPUP_MIN_PAISE } from "@galleryzone/domain";
import { firestoreId } from "./ids.ts";

/** Add money to the wallet through the payment gateway (client, 30 Sep 2026). One payment at a time, within the bounds in the domain. */
export const startWalletTopupInputSchema = z
  .object({ amountPaise: z.number().int().min(WALLET_TOPUP_MIN_PAISE).max(WALLET_TOPUP_MAX_PAISE) })
  .strict();

export type StartWalletTopupInput = z.infer<typeof startWalletTopupInputSchema>;

/** How an aggregator pays in a cash sale's full price: from their wallet, or by transfer to GalleryZone's bank. */
export const remitSaleInputSchema = z.object({ via: z.enum(["wallet", "bank"]) }).strict();

export type RemitSaleInput = z.infer<typeof remitSaleInputSchema>;

export const reserveHoldingInputSchema = z
  .object({
    artworkId: firestoreId,
    gallerySpaceId: firestoreId.optional(),
    /**
     * The price BEFORE GST the aggregator chooses. Month 1 only, never below
     * GalleryZone's offer; omitted means GalleryZone's offer.
     */
    sellingPricePaise: z.number().int().positive().optional(),
  })
  .strict();

export type ReserveHoldingInput = z.infer<typeof reserveHoldingInputSchema>;

/** Ask to keep a piece past its window, with the aggregator's assurance that it will sell. */
export const requestHoldingExtensionInputSchema = z
  .object({ assurance: z.string().trim().min(10, "Tell GalleryZone why this piece will sell").max(1000) })
  .strict();

export type RequestHoldingExtensionInput = z.infer<typeof requestHoldingExtensionInputSchema>;

/** GalleryZone's answer to a request; the note is optional and shown to the aggregator. */
export const decideHoldingExtensionInputSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

export type DecideHoldingExtensionInput = z.infer<typeof decideHoldingExtensionInputSchema>;

// `holdingId` is NOT in this body — the controller reads it from the URL path
// via `@Param("id") id`. Including it here would make the schema require a
// field the frontend never sends and cause `holdingId: Required` 400s on
// every record-sale attempt.
export const recordAggregatorSaleInputSchema = z
  .object({
    soldPricePaise: z.number().int().positive(),
    buyerName: z.string().min(1),
    buyerEmail: z.string().email(),
    buyerPhone: z.string().min(6).optional(),
    deliveryMode: z.enum(["courier", "self_pickup"]),
    paymentRoute: z.enum(["direct_to_galleryzone", "cash_at_premises"]),
    deliveryAddress: z.string().min(1).optional(),
  })
  .strict();

export type RecordAggregatorSaleInput = z.infer<typeof recordAggregatorSaleInputSchema>;

/**
 * Aggregator-raised issue report about a piece they're holding. The
 * `holdingId` is on the URL path (controller reads it via `@Param`), not in
 * the body — same shape as the record-sale endpoint next to it.
 */
export const createHoldingReportInputSchema = z
  .object({
    issueType: z.enum([
      "damaged_in_transit",
      "wrong_piece",
      "quality_issue",
      "coa_nfc_problem",
      "missing_accessories",
      "other",
    ]),
    description: z.string().trim().min(10, "Describe the issue in at least a line or two").max(2000),
  })
  .strict();

export type CreateHoldingReportInput = z.infer<typeof createHoldingReportInputSchema>;

/** Admin resolves a report; the note is optional and shown back to the aggregator. */
export const resolveHoldingReportInputSchema = z
  .object({ note: z.string().trim().max(1000).optional() })
  .strict();

export type ResolveHoldingReportInput = z.infer<typeof resolveHoldingReportInputSchema>;

/**
 * Open a reservation payment intent. The server locks the amount, opens a
 * Razorpay order, and returns the keyId + razorpayOrderId for the browser
 * Checkout. The holding is NOT created yet — it only appears after
 * /verify confirms the payment captured AND the artwork is still available.
 *
 * `idempotencyKey` must be unique per attempt — a double-click or network
 * retry with the same key returns the same intent instead of opening a
 * second Razorpay order (and charging twice).
 */
export const createReservationIntentInputSchema = z
  .object({
    artworkId: firestoreId,
    sellingPricePaise: z.number().int().positive().optional(),
    idempotencyKey: z.string().min(16).max(128),
  })
  .strict();

export type CreateReservationIntentInput = z.infer<typeof createReservationIntentInputSchema>;

/**
 * The signed payload Razorpay Checkout.js hands back on success. Optional —
 * verify is also called from the ondismiss path (payment may have captured
 * out-of-band after the modal closed) and from the webhook, where no signed
 * payload exists. In those cases the server reads the intent's own
 * providerOrderId instead.
 */
export const verifyReservationIntentInputSchema = z
  .object({
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  })
  .strict();

export type VerifyReservationIntentInput = z.infer<typeof verifyReservationIntentInputSchema>;

export interface HoldingDto {
  id: string;
  artworkId: string;
  aggregatorId: string;
  cycleMonth: number;
  advanceAmountPaise: number;
  displayPricePaise: number;
  status: "reserved" | "sold_pending_settlement" | "returned";
  assignedAt: string;
  expiresAt: string;
  windowExtended: boolean;
}
