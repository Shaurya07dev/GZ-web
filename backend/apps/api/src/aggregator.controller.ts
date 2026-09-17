// Aggregator (partner gallery) portal.
//   GET  /v1/aggregator/inventory              reservable pieces with this month's terms
//   GET  /v1/aggregator/holdings               what I hold (any status)
//   POST /v1/aggregator/holdings               reserve — records the advance and takes the piece off the marketplace
//   GET  /v1/aggregator/holdings/:id
//   POST /v1/aggregator/holdings/:id/price     the one allowed price change (never below the offer)
//   POST /v1/aggregator/holdings/:id/return    unsold return — advance refunded, piece back on the marketplace
//   POST /v1/aggregator/holdings/:id/sale      record an in-gallery sale
// The signed MOU is a precondition for reserving (custody without an
// agreement is not a state this platform allows).

import { BadRequestException, Body, Controller, ConflictException, Get, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import {
  AggregatorFlowError,
  AggregatorReadError,
  FirestoreRateConfigStore,
  getAggregatorHolding,
  getLatestMouAcceptance,
  listAggregatorHoldings,
  listAggregatorInventory,
  recordAggregatorSale,
  reserveHolding,
  returnHolding,
  setHoldingDisplayPrice,
  type Db,
} from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { IllegalTransitionError } from "@galleryzone/domain";
import { reserveHoldingInputSchema, recordAggregatorSaleInputSchema, type ReserveHoldingInput, type RecordAggregatorSaleInput } from "@galleryzone/contracts";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ReadCache } from "./read-cache.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const priceSchema = z.object({ displayPricePaise: z.number().int().positive() }).strict();
type PriceBody = z.infer<typeof priceSchema>;

const notFound = () => new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });

function rethrow(error: unknown): never {
  if (error instanceof AggregatorFlowError || error instanceof AggregatorReadError) {
    if (error.message.startsWith("No ")) throw notFound();
    throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "conflict" });
  }
  if (error instanceof IllegalTransitionError) throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
  throw error;
}

@Controller("v1/aggregator")
export class AggregatorController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
  ) {}

  private rates() {
    return loadActiveRates(new FirestoreRateConfigStore(this.db));
  }

  @Roles("aggregator")
  @Get("inventory")
  async inventory() {
    return { artworks: await listAggregatorInventory(this.db, await this.rates()) };
  }

  @Roles("aggregator")
  @Get("holdings")
  async holdings(@Req() req: AuthenticatedRequest) {
    return { holdings: await listAggregatorHoldings(this.db, req.authUser.uid) };
  }

  @Roles("aggregator")
  @Get("holdings/:id")
  async holding(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const holding = await getAggregatorHolding(this.db, req.authUser.uid, id);
    if (!holding) throw notFound();
    return holding;
  }

  @Roles("aggregator")
  @Post("holdings")
  async reserve(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(reserveHoldingInputSchema)) body: ReserveHoldingInput) {
    const mou = await getLatestMouAcceptance(this.db, req.authUser.uid, "aggregator");
    if (!mou) throw new BadRequestException({ type: "about:blank", title: "Sign your Aggregator MOU in My Profile before reserving artwork", status: 403, code: "mou_required" });
    try {
      const result = await reserveHolding({ db: this.db, aggregatorId: req.authUser.uid, artworkId: body.artworkId });
      this.cache.clear();
      const holding = await getAggregatorHolding(this.db, req.authUser.uid, result.holdingId);
      return holding ?? result;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("aggregator")
  @Post("holdings/:id/price")
  async setPrice(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(priceSchema)) body: PriceBody) {
    try {
      await setHoldingDisplayPrice(this.db, req.authUser.uid, id, body.displayPricePaise);
      return getAggregatorHolding(this.db, req.authUser.uid, id);
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("aggregator")
  @Post("holdings/:id/return")
  async returnPiece(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      await returnHolding(this.db, req.authUser.uid, id);
      this.cache.clear();
      return getAggregatorHolding(this.db, req.authUser.uid, id);
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("aggregator")
  @Post("holdings/:id/sale")
  async recordSale(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(recordAggregatorSaleInputSchema)) body: RecordAggregatorSaleInput) {
    const mine = await getAggregatorHolding(this.db, req.authUser.uid, id);
    if (!mine) throw notFound();
    try {
      const result = await recordAggregatorSale({
        db: this.db,
        holdingId: id,
        soldPricePaise: body.soldPricePaise,
        buyerName: body.buyerName,
        buyerEmail: body.buyerEmail,
        buyerPhone: body.buyerPhone,
        deliveryAddress: body.deliveryAddress,
        deliveryMode: body.deliveryMode,
        paymentRoute: body.paymentRoute,
      });
      this.cache.clear();
      return result;
    } catch (error) {
      rethrow(error);
    }
  }
}
