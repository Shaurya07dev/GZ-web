// Manual ownership / display transfers (the "Transfer rights" flow). Sale-
// triggered transfers never come through here — checkout.ts writes those
// when an order is paid. Only the two parties to a transfer can read it;
// everyone else gets a 404 (never a 403 that confirms the id exists).
//
// Resale royalty (3 Nov 2026): an ownership transfer now carries the price
// the piece is changing hands at. The recipient confirms on `/accept`
// (moves to `awaiting_payment`); the SENDER then pays 5% through Razorpay
// (2% artist royalty + 3% platform + 18% GST on the fee). The webhook
// flips the transfer to `accepted` and writes the artist's royalty
// settlement, which admin pays out by hand — same pattern as aggregator
// commissions. Display transfers (unchanged) still go straight to accepted.

import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import {
  acceptTransfer,
  attachTransferFeeProviderOrder,
  cancelTransfer,
  Collections,
  computeTransferFee,
  endDisplay,
  getCurrentUser,
  getTransfer,
  initiateTransfer,
  markTransferFeePaid,
  OwnershipConflictError,
  OwnershipNotFoundError,
  type ArtworkDoc,
  type Db,
  type OwnershipEvent,
  type UserDoc,
} from "@galleryzone/db";
import { IllegalTransitionError } from "@galleryzone/domain";
import type { AppEnv } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB, ENV } from "./db.module.ts";
import { CacheKeys, ReadCache } from "./read-cache.ts";
import { Emails } from "./mail/emails.ts";
import { Razorpay } from "./payments/razorpay.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { toPublicEvent } from "./verify.controller.ts";

const initiateSchema = z
  .object({
    kind: z.enum(["ownership", "display"]).default("ownership"),
    toName: z.string().trim().min(2).max(120),
    toEmail: z.string().email(),
    displayStartsAt: z.string().datetime().optional(),
    displayEndsAt: z.string().datetime().optional(),
    /** Integer paise, required for ownership transfers (drives the 5% fee). */
    givingPricePaise: z.number().int().positive().optional(),
  })
  .strict();
type InitiateBody = z.infer<typeof initiateSchema>;

function problem(status: number, title: string, code: string) {
  return { type: "about:blank", title, status, code };
}

function rethrow(error: unknown): never {
  if (error instanceof OwnershipNotFoundError) throw new NotFoundException(problem(404, "Not found", "not_found"));
  if (error instanceof OwnershipConflictError) {
    const code = error.message.includes("sign up") ? "recipient_not_registered" : "conflict";
    throw new ConflictException(problem(409, error.message, code));
  }
  if (error instanceof IllegalTransitionError) throw new ConflictException(problem(409, error.message, "illegal_transition"));
  throw error;
}

/** A party's view: the public fields plus the invite email (they're one of the two people it concerns), the artwork id and title. */
async function toPartyDto(db: Db, e: OwnershipEvent) {
  const artwork = (await db.collection(Collections.artworks).doc(e.artworkId).get()).data() as ArtworkDoc | undefined;
  return {
    ...toPublicEvent(e),
    artworkId: e.artworkId,
    artworkTitle: artwork?.title ?? "Artwork",
    toEmail: e.toEmail,
    givingPricePaise: e.givingPricePaise ?? null,
    royaltyPaise: e.royaltyPaise ?? null,
    platformFeeNetPaise: e.platformFeeNetPaise ?? null,
    feeGstPaise: e.feeGstPaise ?? null,
    feeTotalPaise: e.feeTotalPaise ?? null,
    feePaidAt: e.feePaidAt?.toDate().toISOString() ?? null,
  };
}

@Controller("v1")
export class OwnershipController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
    private readonly cache: ReadCache,
    private readonly emails: Emails,
    private readonly razorpay: Razorpay,
  ) {}

  @Roles("customer", "artist", "aggregator")
  @Post("artworks/:artworkId/transfers")
  async initiate(@Req() req: AuthenticatedRequest, @Param("artworkId") artworkId: string, @Body(new ZodValidationPipe(initiateSchema)) body: InitiateBody) {
    try {
      if (body.kind === "ownership" && !body.givingPricePaise) {
        throw new ConflictException(problem(409, "Enter the price this piece is changing hands at", "giving_price_required"));
      }
      const event = await initiateTransfer(this.db, {
        artworkId,
        byUserId: req.authUser.uid,
        kind: body.kind,
        toName: body.toName,
        toEmail: body.toEmail,
        displayStartsAt: body.displayStartsAt ? new Date(body.displayStartsAt) : undefined,
        displayEndsAt: body.displayEndsAt ? new Date(body.displayEndsAt) : undefined,
        givingPricePaise: body.givingPricePaise,
      });
      this.cache.invalidate(CacheKeys.verify(artworkId));
      const dto = await toPartyDto(this.db, event);
      if (event.toEmail) {
        void this.emails
          .transferInvite({
            transferId: dto.id,
            toEmail: event.toEmail,
            toName: event.toName,
            fromName: event.fromName,
            title: dto.artworkTitle,
            kind: event.kind,
            givingPricePaise: event.givingPricePaise ?? null,
          })
          .catch(this.emails.swallow("transfer mail"));
      }
      return dto;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer", "artist", "aggregator")
  @Get("transfers/:id")
  async get(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const event = await getTransfer(this.db, id);
    if (!event) throw new NotFoundException(problem(404, "Not found", "not_found"));
    const me = (await this.db.collection(Collections.users).doc(req.authUser.uid).get()).data() as UserDoc | undefined;
    const isParty = event.fromUserId === req.authUser.uid || event.toUserId === req.authUser.uid || (me && event.toEmail === me.email.toLowerCase());
    if (!isParty) throw new NotFoundException(problem(404, "Not found", "not_found"));
    return toPartyDto(this.db, event);
  }

  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/accept")
  async accept(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    // The invite is matched on email, so the email must be proven: otherwise anyone who registers
    // the invited address before its owner does (the transfer id is public on /verify) takes the title.
    if (!req.authUser.emailVerified) {
      throw new ForbiddenException(problem(403, "Verify your email address to accept this transfer", "email_not_verified"));
    }
    try {
      const event = await acceptTransfer(this.db, { transferId: id, byUserId: req.authUser.uid });
      this.cache.invalidate(CacheKeys.verify(event.artworkId));
      const dto = await toPartyDto(this.db, event);
      // Two paths from here:
      //  - `accepted`: display transfer, or a legacy ownership event with no
      //    giving price. Title has passed; tell the sender.
      //  - `awaiting_payment`: ownership event with a giving price. The
      //    sender still owes the 5% fee; they'll be prompted next.
      if (event.status === "accepted") {
        void this.emails
          .transferAccepted({
            transferId: dto.id,
            artworkId: event.artworkId,
            title: dto.artworkTitle,
            toName: event.toName,
            kind: event.kind,
            fromUserId: event.fromUserId,
          })
          .catch(this.emails.swallow("transfer accepted mail"));
      } else if (event.status === "awaiting_payment") {
        void this.emails
          .transferFeeDue({
            transferId: dto.id,
            title: dto.artworkTitle,
            toName: event.toName,
            fromUserId: event.fromUserId,
            givingPricePaise: event.givingPricePaise ?? 0,
            feeTotalPaise: event.feeTotalPaise ?? 0,
          })
          .catch(this.emails.swallow("transfer fee-due mail"));
      }
      return dto;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/cancel")
  async cancel(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      const event = await cancelTransfer(this.db, { transferId: id, byUserId: req.authUser.uid });
      this.cache.invalidate(CacheKeys.verify(event.artworkId));
      const dto = await toPartyDto(this.db, event);
      // Either party may cancel, so tell the other one: a sender who withdraws tells the invitee; an invitee who declines tells the sender.
      if (event.fromUserId === req.authUser.uid) {
        void this.emails.transferCancelled({ transferId: dto.id, toEmail: event.toEmail, fromName: event.fromName, title: dto.artworkTitle, kind: event.kind }).catch(this.emails.swallow("transfer cancelled mail"));
      } else {
        void this.emails.transferDeclined({ transferId: dto.id, artworkId: event.artworkId, title: dto.artworkTitle, toName: event.toName, kind: event.kind, fromUserId: event.fromUserId }).catch(this.emails.swallow("transfer declined mail"));
      }
      return dto;
    } catch (error) {
      rethrow(error);
    }
  }

  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/end-display")
  async endDisplay(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    try {
      const event = await endDisplay(this.db, { transferId: id, byUserId: req.authUser.uid });
      this.cache.invalidate(CacheKeys.verify(event.artworkId));
      return toPartyDto(this.db, event);
    } catch (error) {
      rethrow(error);
    }
  }

  // --- 5% fee payment (resale royalty) --------------------------------------
  //
  // Only the sender (fromUserId) may start or verify. The transfer must be
  // in `awaiting_payment` — the state the recipient's accept put it in.

  private async senderOwns(req: AuthenticatedRequest, id: string): Promise<OwnershipEvent> {
    const event = await getTransfer(this.db, id);
    if (!event || event.fromUserId !== req.authUser.uid) throw new NotFoundException(problem(404, "Not found", "not_found"));
    return event;
  }

  /**
   * POST /v1/transfers/:id/fee-session — the sender's Razorpay checkout.
   * Idempotent-ish: a session started twice reuses the stored gateway order
   * when PAYMENTS_MODE=razorpay; otherwise returns a simulated marker.
   */
  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/fee-session")
  async feeSession(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const event = await this.senderOwns(req, id);
    if (event.status !== "awaiting_payment") {
      throw new BadRequestException(problem(409, `Transfer is ${event.status}`, "transfer_not_awaiting_payment"));
    }
    const amount = event.feeTotalPaise ?? computeTransferFee(event.givingPricePaise ?? 0).feeTotalPaise;
    if (amount <= 0) throw new BadRequestException(problem(409, "Missing fee amount", "fee_unavailable"));

    if (this.env.paymentsMode !== "razorpay") {
      return { mode: "simulated" as const, amountPaise: amount };
    }
    const user = await getCurrentUser(this.db, req.authUser.uid, { touchLogin: false });
    const gateway = await this.razorpay.createTransferFeeOrder({ transferId: id, amountPaise: amount, senderId: req.authUser.uid });
    await attachTransferFeeProviderOrder(this.db, id, gateway.id);
    return {
      mode: "razorpay" as const,
      keyId: this.razorpay.keyId,
      razorpayOrderId: gateway.id,
      amountPaise: amount,
      currency: "INR",
      name: "GalleryZone",
      description: `Transfer royalty for ${event.artworkId}`,
      prefill: { name: user?.name ?? "", email: user?.email ?? "", contact: user?.phone ?? "" },
    };
  }

  /**
   * POST /v1/transfers/:id/fee-verify — called when the sender returns from
   * Razorpay. Re-reads the gateway order over our own authenticated
   * connection; the webhook is still the source of truth (and whichever
   * arrives second is a no-op through `markTransferFeePaid`).
   */
  @Roles("customer", "artist", "aggregator")
  @Post("transfers/:id/fee-verify")
  async feeVerify(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const event = await this.senderOwns(req, id);
    if (event.status === "accepted") return toPartyDto(this.db, event);
    if (event.status !== "awaiting_payment") {
      throw new BadRequestException(problem(409, `Transfer is ${event.status}`, "transfer_not_awaiting_payment"));
    }
    const providerOrderId = event.feeProviderOrderId;
    if (!providerOrderId) {
      throw new BadRequestException(problem(409, "No payment has been started for this transfer", "payment_not_started"));
    }

    const gateway = await this.razorpay.fetchOrder(providerOrderId);
    if (gateway.status !== "paid") return toPartyDto(this.db, event);
    if (event.feeTotalPaise != null && (gateway.amount !== event.feeTotalPaise || gateway.amount_paid !== event.feeTotalPaise)) {
      throw new BadRequestException(problem(409, "Paid amount does not match the transfer fee", "amount_mismatch"));
    }

    const payment = (await this.razorpay.fetchPayments(providerOrderId)).find((p) => p.status === "captured");
    if (!payment) return toPartyDto(this.db, event);

    try {
      await markTransferFeePaid(this.db, {
        transferId: id,
        providerPaymentId: payment.id,
        reportedAmountPaise: gateway.amount_paid ?? null,
      });
    } catch (error) {
      rethrow(error);
    }
    this.cache.invalidate(CacheKeys.verify(event.artworkId));
    const updated = await getTransfer(this.db, id);
    const dto = await toPartyDto(this.db, updated ?? event);
    void this.emails
      .transferAccepted({
        transferId: id,
        artworkId: event.artworkId,
        title: dto.artworkTitle,
        toName: event.toName,
        kind: event.kind,
        fromUserId: event.fromUserId,
      })
      .catch(this.emails.swallow("transfer accepted mail"));
    return dto;
  }
}
