// Receives ShipRocket's shipment-status webhooks and translates each one
// into an update on either the aggregator holding (inbound: artist →
// aggregator) or the aggregator sale (outbound: aggregator → buyer). The
// orderReference we sent at booking time keys the write: holding-{id} for
// inbound, sale-{id} for outbound.

import { Body, Controller, Headers, HttpCode, Logger, Post, Req } from "@nestjs/common";
import { Timestamp } from "firebase-admin/firestore";
import type { Request } from "express";
import { Inject } from "@nestjs/common";
import { Collections, type Db } from "@galleryzone/db";
import { Public } from "./auth/roles.decorator.ts";
import { SkipThrottle } from "@nestjs/throttler";
import { DB } from "./db.module.ts";
import {
  stageFromWebhook,
  verifyWebhookSignature,
  type WebhookPayload,
} from "./shiprocket.ts";

@Controller("v1")
export class ShiprocketController {
  private readonly logger = new Logger(ShiprocketController.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  // ShipRocket sends the shared-secret token in whichever HTTP header name
  // was selected on their webhook config screen. Default is x-api-key; we
  // also accept x-shiprocket-signature in case an older account was set up
  // with that name.
  // Route path intentionally avoids the strings "shiprocket" / "sr" / "kr" —
  // ShipRocket's own webhook config validator refuses URLs that contain
  // those keywords (security measure to prevent misconfigured webhooks
  // targeting their own infra). We call it "courier-webhook" instead.
  @Public()
  @SkipThrottle()
  @Post("shipping/courier-webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-api-key") apiKey: string | undefined,
    @Headers("x-shiprocket-signature") legacySignature: string | undefined,
    @Body() body: WebhookPayload,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    const token = apiKey ?? legacySignature;
    if (!verifyWebhookSignature(raw, token ?? null)) {
      // 200 so ShipRocket stops retrying but we don't act on it. Logged so
      // ops can see if a real event is failing on signature config.
      this.logger.warn(`shiprocket webhook token mismatch for order ${body.order_id}`);
      return { received: true, matched: false };
    }
    if (!body.order_id || !body.current_status) {
      return { received: true, matched: false };
    }

    const stage = stageFromWebhook(body.current_status);
    const patch = {
      shiprocketStage: stage,
      trackingId: body.awb_code ?? null,
      carrier: body.courier_name ?? null,
      trackedAt: Timestamp.now(),
    };

    if (body.order_id.startsWith("holding-")) {
      const holdingId = body.order_id.slice("holding-".length);
      await this.db
        .collection(Collections.aggregatorHoldings)
        .doc(holdingId)
        .set(
          {
            inboundShiprocketStage: patch.shiprocketStage,
            inboundTrackingId: patch.trackingId,
            inboundCarrier: patch.carrier,
            inboundTrackedAt: patch.trackedAt,
          },
          { merge: true },
        );
      return { received: true, matched: true, leg: "inbound", stage };
    }

    if (body.order_id.startsWith("sale-")) {
      const saleId = body.order_id.slice("sale-".length);
      await this.db
        .collection(Collections.aggregatorSales)
        .doc(saleId)
        .set(patch, { merge: true });
      return { received: true, matched: true, leg: "outbound", stage };
    }

    this.logger.warn(`shiprocket webhook: unknown order_id prefix: ${body.order_id}`);
    return { received: true, matched: false };
  }
}
