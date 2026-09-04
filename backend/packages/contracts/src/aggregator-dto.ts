// Aggregator/consignment request contracts — reserve, recordSale, release.

import { z } from "zod";

export const reserveHoldingInputSchema = z
  .object({
    artworkId: z.string().uuid(),
    gallerySpaceId: z.string().uuid().optional(),
  })
  .strict();

export type ReserveHoldingInput = z.infer<typeof reserveHoldingInputSchema>;

export const recordAggregatorSaleInputSchema = z
  .object({
    holdingId: z.string().uuid(),
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

export const advanceShipmentInputSchema = z
  .object({
    saleId: z.string().uuid(),
    to: z.enum(["dispatched", "delivered"]),
    courierRef: z.string().optional(),
  })
  .strict();

export const markRemittedInputSchema = z
  .object({
    saleId: z.string().uuid(),
  })
  .strict();

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
