// Delivery-challan download — Rule 55.
//
// Two routes, mirroring the invoice controller's pattern:
//
//   GET /v1/holdings/:holdingId/delivery-challan.pdf?leg=inbound|return
//     Authenticated download for the aggregator (their own holding),
//     the artist (the artwork's artist), or any platform admin. Picks
//     the inbound or return challan based on the ?leg= query. Returns
//     404 instead of 403 for unrelated callers so we don't leak holding
//     existence to a scanner.
//
//   GET /v1/holdings/public/:holdingId/:token/:leg/delivery-challan.pdf
//     Shiprocket's unauthenticated path. HMAC-signed with
//     RAZORPAY_WEBHOOK_SECRET keyed off "<holdingId>:<leg>" so the two
//     legs get independent tokens. Path shape mirrors the tax-invoice
//     public route for the same reason (Shiprocket's file-extension
//     sniffer only accepts .pdf at the end).
//
// Stamps are already done by shiprocket-booking.ts BEFORE handing the
// URL to Shiprocket — the download route never triggers a stamp, only
// reads the frozen snapshot and renders it. If the snapshot is missing
// we 404 (the shipment leg was booked without passing through the
// stamp — broken flow, not a client error).

import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import type { AppEnv } from "@galleryzone/config";
import {
  Collections,
  type AggregatorHoldingDoc,
  type ArtworkDoc,
  type Db,
  type DeliveryChallanSnapshot,
} from "@galleryzone/db";
import { Public, Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { renderDeliveryChallanPdf } from "./delivery-challan-pdf.ts";

/** Sign a (holdingId, leg) tuple so inbound + return tokens are
 *  distinct — a leaked inbound-leg URL mustn't let a scraper fetch the
 *  return-leg challan as well. */
function signChallanTarget(holdingId: string, leg: ChallanLeg, secret: string): string {
  return createHmac("sha256", secret).update(`${holdingId}:${leg}`).digest("hex");
}
function verifyChallanToken(
  holdingId: string,
  leg: ChallanLeg,
  token: string,
  secret: string,
): boolean {
  if (!token || !secret) return false;
  const expected = signChallanTarget(holdingId, leg, secret);
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(token, "utf8"));
}

type ChallanLeg = "inbound" | "return";
function isLeg(x: string | undefined): x is ChallanLeg {
  return x === "inbound" || x === "return";
}

/** Build the public URL Shiprocket will fetch for a given leg. Called
 *  from shiprocket-booking right after the stamp, result passed to
 *  bookShipment's `invoiceUrl` param. */
export function challanUrlForShiprocket(args: {
  publicApiUrl: string;
  holdingId: string;
  leg: ChallanLeg;
  secret: string;
}): string {
  const token = signChallanTarget(args.holdingId, args.leg, args.secret);
  return `${args.publicApiUrl}/v1/holdings/public/${encodeURIComponent(
    args.holdingId,
  )}/${token}/${args.leg}/delivery-challan.pdf`;
}

@Controller("v1/holdings")
export class DeliveryChallansController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  @Roles("aggregator", "artist", "platform_admin")
  @Get(":holdingId/delivery-challan.pdf")
  @Header("Content-Type", "application/pdf")
  async download(
    @Req() req: AuthenticatedRequest,
    @Param("holdingId") holdingId: string,
    @Query("leg") legParam: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const leg: ChallanLeg = isLeg(legParam) ? legParam : "inbound";

    const holdingSnap = await this.db
      .collection(Collections.aggregatorHoldings)
      .doc(holdingId)
      .get();
    if (!holdingSnap.exists) {
      throw new NotFoundException({
        type: "about:blank",
        title: "Not found",
        status: 404,
        code: "not_found",
      });
    }
    const holding = holdingSnap.data() as AggregatorHoldingDoc;

    // Access control: aggregator who owns the holding, artist whose
    // piece is on the holding, or an admin. Anyone else → 404.
    const grants = req.authUser.grants;
    const isAdmin = grants.includes("platform_admin");
    const isOwningAggregator = holding.aggregatorId === req.authUser.uid;
    let isOwningArtist = false;
    if (!isAdmin && !isOwningAggregator) {
      const artworkSnap = await this.db
        .collection(Collections.artworks)
        .doc(holding.artworkId)
        .get();
      const artwork = artworkSnap.data() as ArtworkDoc | undefined;
      isOwningArtist = artwork?.artistId === req.authUser.uid;
    }
    if (!isAdmin && !isOwningAggregator && !isOwningArtist) {
      throw new NotFoundException({
        type: "about:blank",
        title: "Not found",
        status: 404,
        code: "not_found",
      });
    }

    const snapshot = pickChallanSnapshot(holding, leg);
    if (!snapshot) {
      // Challan hasn't been stamped yet — the shipment leg hasn't been
      // booked. 404 so a polling client can retry when the stamp lands.
      throw new NotFoundException({
        type: "about:blank",
        title: "Delivery challan not available yet",
        status: 404,
        code: "challan_not_stamped",
      });
    }

    const pdf = await renderDeliveryChallanPdf(toRendererSnapshot(snapshot));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="delivery-challan-${snapshot.number.replace(/\//g, "-")}.pdf"`,
    );
    res.setHeader("Content-Length", String(pdf.byteLength));
    res.end(pdf);
  }

  @Public()
  @Get("public/:holdingId/:token/:leg/delivery-challan.pdf")
  @Header("Content-Type", "application/pdf")
  async downloadPublic(
    @Param("holdingId") holdingId: string,
    @Param("token") token: string | undefined,
    @Param("leg") legParam: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const secret = this.env.razorpayWebhookSecret;
    if (!secret || !isLeg(legParam)) {
      throw new NotFoundException({
        type: "about:blank",
        title: "Not found",
        status: 404,
        code: "not_found",
      });
    }
    if (!token || !verifyChallanToken(holdingId, legParam, token, secret)) {
      throw new NotFoundException({
        type: "about:blank",
        title: "Not found",
        status: 404,
        code: "not_found",
      });
    }
    const holdingSnap = await this.db
      .collection(Collections.aggregatorHoldings)
      .doc(holdingId)
      .get();
    if (!holdingSnap.exists) {
      throw new NotFoundException({
        type: "about:blank",
        title: "Not found",
        status: 404,
        code: "not_found",
      });
    }
    const holding = holdingSnap.data() as AggregatorHoldingDoc;
    const snapshot = pickChallanSnapshot(holding, legParam);
    if (!snapshot) {
      throw new NotFoundException({
        type: "about:blank",
        title: "Not found",
        status: 404,
        code: "not_found",
      });
    }
    const pdf = await renderDeliveryChallanPdf(toRendererSnapshot(snapshot));
    res.setHeader(
      "Content-Disposition",
      `inline; filename="delivery-challan-${snapshot.number.replace(/\//g, "-")}.pdf"`,
    );
    res.setHeader("Content-Length", String(pdf.byteLength));
    res.end(pdf);
  }
}

function pickChallanSnapshot(
  holding: AggregatorHoldingDoc,
  leg: ChallanLeg,
): DeliveryChallanSnapshot | null {
  if (leg === "inbound") return holding.deliveryChallan ?? null;
  return holding.returnDeliveryChallan ?? null;
}

/** The DB snapshot stores dates as Firestore Timestamps; the renderer
 *  wants plain Date objects. This mapper walks the two branches that
 *  differ and yields the renderer-shaped snapshot. Only called on the
 *  read path, so no risk of persisting plain Dates to Firestore. */
function toRendererSnapshot(snapshot: DeliveryChallanSnapshot) {
  return {
    ...snapshot,
    challanDate: snapshot.challanDate.toDate(),
    returnDeadline: snapshot.returnDeadline?.toDate() ?? null,
    currentDeadline: snapshot.currentDeadline?.toDate() ?? null,
    ewayBill: {
      number: snapshot.ewayBill.number,
      generatedAt: snapshot.ewayBill.generatedAt?.toDate() ?? null,
      validUntil: snapshot.ewayBill.validUntil?.toDate() ?? null,
    },
  };
}
