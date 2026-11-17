// Artist artwork submission/editing + the real admin moderation gate —
// closes the gap the mock frontend had (auto-approve on submit). Real work
// lives in @galleryzone/db/artist-artworks.ts.

import { BadRequestException, Body, Controller, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import * as Sentry from "@sentry/node";
import { z } from "zod";
import {
  ArtistArtworkError,
  FirestoreRateConfigStore,
  NfcError,
  approveArtwork,
  checkNfcTag,
  artworkRarityValues,
  getArtistArtwork,
  hasKycForListing,
  listingReadinessIssues,
  listingReadinessMessage,
  linkNfcTag,
  listArtistOrders,
  listArtistPenalties,
  listHoldingsForArtist,
  listSettlements,
  lockNfcTag,
  markSoldElsewhere,
  listArtistArtworksOwned,
  nfcStateViewOf,
  rejectArtwork,
  setArtworkRarity,
  submitArtwork,
  updateArtwork,
  type Db,
} from "@galleryzone/db";
import { checkNfcInputSchema, reportNfcFailureInputSchema, tagUidInputSchema, type CheckNfcInput, type NfcCheckDto, type NfcStateDto, type ReportNfcFailureInput, type TagUidInput } from "@galleryzone/contracts";
import { IllegalTransitionError, returnShippingTotal } from "@galleryzone/domain";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { CacheKeys, ReadCache } from "./read-cache.ts";
import { Emails } from "./mail/emails.ts";
import { Collections, type AggregatorHoldingDoc, type ArtworkDoc, type ProfileDoc, type UserDoc, requestArtistReturn } from "@galleryzone/db";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { Razorpay } from "./payments/razorpay.ts";
import { getShippingRate, isShiprocketConfigured } from "./shiprocket.ts";
import { bookReturnShipment } from "./shiprocket-booking.ts";
import { FieldValue } from "firebase-admin/firestore";

const returnDropAddressSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    phone: z.string().trim().min(10).max(16).nullable().optional(),
    line1: z.string().trim().min(1).max(160),
    line2: z.string().trim().max(160).nullable().optional(),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(80),
    pincode: z.string().trim().regex(/^\d{6}$/, "A 6-digit Indian pincode is required"),
  })
  .strict();
type ReturnDropAddressInput = z.infer<typeof returnDropAddressSchema>;

const returnVerifySchema = z
  .object({
    holdingId: z.string().trim().min(1).max(200),
    razorpayOrderId: z.string().trim().min(1).max(200),
    razorpayPaymentId: z.string().trim().min(1).max(200),
    razorpaySignature: z.string().trim().min(1).max(256),
  })
  .strict();
type ReturnVerifyInput = z.infer<typeof returnVerifySchema>;

const physicalSchema = z
  .object({
    weightKg: z.number().positive().max(500).nullable(),
    framing: z.string().trim().max(80).nullable(),
    format: z.string().trim().max(80).nullable(),
    hangingHardwareIncluded: z.boolean(),
    packagingConfirmed: z.boolean(),
  })
  .strict();

const artworkFields = {
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000),
  // Paintings-only enforcement (owner directive, repeated 5 Nov 2026).
  // The frontend dropdown is already restricted to "painting"; this
  // server-side enum guard ensures a stale client or a direct API call
  // cannot sneak in sculpture/digital/printmaking etc.
  category: z
    .string()
    .trim()
    .transform((s) => s.toLowerCase())
    .refine((s) => s === "painting", {
      message: "GalleryZone currently only accepts paintings. Choose 'Painting' as the category.",
    }),
  medium: z.string().trim().min(1).max(80),
  artistPricePaise: z.number().int().positive().max(1_000_000_000),
  listingType: z.enum(["marketplace_only", "aggregator_only", "marketplace_and_aggregator"]),
  dimensions: z.string().trim().max(80).optional(),
  yearCreated: z.number().int().min(1800).max(2100).optional(),
  mode: z.enum(["draft", "review"]).optional(),
  artworkType: z.string().trim().max(80).nullable().optional(),
  paintingStyle: z.string().trim().max(80).nullable().optional(),
  physical: physicalSchema.nullable().optional(),
  exclusive: z.boolean().optional(),
};

// Retired: a chip is linked from the app through /nfc/link, after it has been
// written (NFC_IMPLEMENTATION.md §3). Web builds from before that still send the
// field, empty, with every submit — so empty is accepted and dropped, while a
// value (the old "simulate a tag" button) is refused out loud instead of being
// silently swallowed.
const retiredNfcTagId = z
  .string()
  .max(80)
  .nullable()
  .optional()
  .refine((value) => !value?.trim(), { message: "NFC tags are linked from the GalleryZone app now: write the chip there, and it is recorded on this artwork" });
const dropRetired = <T extends { nfcTagId?: unknown }>({ nfcTagId: _retired, ...rest }: T): Omit<T, "nfcTagId"> => rest;

const submitArtworkSchema = z.object({ ...artworkFields, nfcTagId: retiredNfcTagId }).strict().transform(dropRetired);
type SubmitArtworkBody = z.infer<typeof submitArtworkSchema>;

const updateArtworkSchema = z.object({ ...artworkFields, nfcTagId: retiredNfcTagId }).partial().strict().transform(dropRetired);
type UpdateArtworkBody = z.infer<typeof updateArtworkSchema>;

const rejectSchema = z.object({ reason: z.string().min(1) }).strict();
// The rank is compulsory: an approval without one is a 400, never a live piece with no rank.
const approveSchema = z.object({ rarity: z.enum([...artworkRarityValues]) }).strict();
type ApproveBody = z.infer<typeof approveSchema>;
type RejectBody = z.infer<typeof rejectSchema>;

const notFound = () => new NotFoundException({ type: "about:blank", title: "Artwork not found", status: 404, code: "not_found" });

@Controller("v1")
export class ArtistArtworksController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly cache: ReadCache,
    private readonly emails: Emails,
    private readonly razorpay: Razorpay,
  ) {}

  private async artworkOf(id: string): Promise<(ArtworkDoc & { id: string }) | null> {
    const snap = await this.db.collection(Collections.artworks).doc(id).get();
    return snap.exists ? { id, ...(snap.data() as ArtworkDoc) } : null;
  }

  private bust(artworkId: string, artistId?: string) {
    this.cache.invalidate(CacheKeys.marketplace);
    this.cache.invalidate(CacheKeys.artwork(artworkId));
    this.cache.invalidate(CacheKeys.verify(artworkId));
    if (artistId) this.cache.invalidate(CacheKeys.artistArtworks(artistId));
  }

  private rates() {
    return loadActiveRates(new FirestoreRateConfigStore(this.db));
  }

  @Roles("artist")
  @Get("artist/artworks")
  async mine(@Req() req: AuthenticatedRequest) {
    return { artworks: await listArtistArtworksOwned(this.db, req.authUser.uid, await this.rates()) };
  }

  @Roles("artist")
  @Get("artist/orders")
  async orders(@Req() req: AuthenticatedRequest) {
    return { orders: await listArtistOrders(this.db, req.authUser.uid) };
  }

  @Roles("artist")
  @Get("artist/penalties")
  async penalties(@Req() req: AuthenticatedRequest) {
    return { penalties: await listArtistPenalties(this.db, req.authUser.uid) };
  }

  // Pieces of this artist's that are (or were) with an aggregator — with
  // the inbound ShipRocket stage so the dashboard can show a tracker.
  @Roles("artist")
  @Get("artist/gallery-spaces")
  async myGallerySpaces(@Req() req: AuthenticatedRequest) {
    return { holdings: await listHoldingsForArtist(this.db, req.authUser.uid, await this.rates()) };
  }

  /**
   * Artist-initiated return at the end of the 6-month listing period —
   * STEP 1 (quote).
   *
   * Validates the gate, resolves pickup (current aggregator's gallery)
   * and drop (artist's chosen address), asks Shiprocket for the reverse-
   * leg rate, applies the same 2% + 18% GST pass-through every other
   * checkout here uses, creates a Razorpay order, and stamps the quote
   * on the holding so step 2's verify endpoint knows what it's checking.
   *
   * Nothing is booked with Shiprocket yet — that happens only AFTER
   * verify() confirms Razorpay captured the payment. The artist can
   * walk away at this stage and nothing is left in a half-done state;
   * stamping the quote is pure bookkeeping.
   */
  @Roles("artist")
  @Post("artist/artworks/:id/request-return")
  async requestReturn(
    @Req() req: AuthenticatedRequest,
    @Param("id") artworkId: string,
    @Body(new ZodValidationPipe(returnDropAddressSchema)) body: ReturnDropAddressInput,
  ) {
    if (!isShiprocketConfigured()) {
      throw new BadRequestException({
        type: "about:blank",
        title: "Return shipping isn't available right now — Shiprocket isn't configured.",
        status: 503,
        code: "shipping_unavailable",
      });
    }
    const rates = await this.rates();
    let target: { holdingId: string; aggregatorId: string; returnEligibleAt: Date };
    try {
      target = await requestArtistReturn(this.db, req.authUser.uid, artworkId, rates);
    } catch (error) {
      const asAny = error as Error & { code?: string; eligibleAt?: string };
      if (asAny?.code === "too_early") {
        throw new BadRequestException({
          type: "about:blank",
          title: asAny.message,
          status: 400,
          code: "too_early",
          eligibleAt: asAny.eligibleAt,
        });
      }
      throw error;
    }

    // Load everyone the quote and the eventual Shiprocket call need.
    const [aggProfileSnap, aggUserSnap, artworkSnap] = await Promise.all([
      this.db.collection(`users/${target.aggregatorId}/profile`).doc("data").get(),
      this.db.collection(Collections.users).doc(target.aggregatorId).get(),
      this.db.collection(Collections.artworks).doc(artworkId).get(),
    ]);
    const aggProfile = aggProfileSnap.data() as ProfileDoc | undefined;
    const aggUser = aggUserSnap.data() as UserDoc | undefined;
    const artwork = artworkSnap.data() as ArtworkDoc | undefined;
    if (!aggProfile?.pickupPincode) {
      throw new BadRequestException({
        type: "about:blank",
        title: "The current aggregator hasn't set a pickup address yet. We can't quote the reverse leg.",
        status: 400,
        code: "aggregator_missing_pickup",
      });
    }
    if (!artwork) throw new NotFoundException();

    // Shiprocket serviceability — the authoritative price for this exact
    // pickup → drop pair at the artwork's weight and declared value.
    const quote = await getShippingRate({
      pickupPincode: aggProfile.pickupPincode,
      dropPincode: body.pincode,
      weightKg: artwork.physical?.weightKg ?? 2,
      valueInr: Math.max(1, Math.round((artwork.listing?.displayPricePaise ?? 0) / 100)),
    });
    if (!quote) {
      throw new BadRequestException({
        type: "about:blank",
        title: "No courier can serve that pincode for this piece right now. Try another drop pincode.",
        status: 400,
        code: "not_serviceable",
      });
    }

    const breakdown = returnShippingTotal(quote.ratePaise, rates);

    // Razorpay order. `receipt` identifies the holding so a webhook can
    // find it; the 40-char Razorpay receipt cap is honoured by the
    // shared `post()` helper in payments/razorpay.ts.
    const razorpayOrder = await this.razorpay.createOrder({
      orderId: `return:${target.holdingId}`,
      amountPaise: breakdown.totalPaise,
      customerId: req.authUser.uid,
    });

    const dropAddress: NonNullable<AggregatorHoldingDoc["returnDropAddress"]> = {
      name: body.name,
      phone: body.phone ?? null,
      line1: body.line1,
      line2: body.line2 ?? null,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
    };

    await this.db
      .collection(Collections.aggregatorHoldings)
      .doc(target.holdingId)
      .set(
        {
          returnRazorpayOrderId: razorpayOrder.id,
          returnShippingBasePaise: breakdown.shippingBasePaise,
          returnConvenienceFeePaise: breakdown.convenienceFeePaise,
          returnConvenienceGstPaise: breakdown.convenienceGstPaise,
          returnShippingTotalPaise: breakdown.totalPaise,
          returnDropAddress: dropAddress,
        },
        { merge: true },
      );

    return {
      holdingId: target.holdingId,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: this.razorpay.keyId,
      amountPaise: breakdown.totalPaise,
      currency: razorpayOrder.currency,
      breakdown,
      pickup: {
        name: aggProfile.companyName ?? aggUser?.name ?? "Current aggregator",
        line1: aggProfile.pickupLine1,
        city: aggProfile.pickupCity,
        state: aggProfile.pickupState,
        pincode: aggProfile.pickupPincode,
      },
      drop: dropAddress,
      carrier: quote.carrier,
      estimatedDeliveryDays: quote.estimatedDeliveryDays,
    };
  }

  /**
   * STEP 2 (verify). Razorpay Checkout.js posts back order_id, payment_id
   * and signature; we verify the signature, re-read the order from
   * Razorpay (necessary-not-sufficient check — signature alone can't
   * prove the order is currently paid for the right amount), then and
   * only then book Shiprocket. Idempotent on `artistReturnRequestedAt`:
   * a replayed verify finds the stamp already set and short-circuits.
   */
  @Roles("artist")
  @Post("artist/artworks/:id/request-return/verify")
  async requestReturnVerify(
    @Req() req: AuthenticatedRequest,
    @Param("id") artworkId: string,
    @Body(new ZodValidationPipe(returnVerifySchema)) body: ReturnVerifyInput,
  ) {
    const holdingSnap = await this.db
      .collection(Collections.aggregatorHoldings)
      .doc(body.holdingId)
      .get();
    const holding = holdingSnap.data() as AggregatorHoldingDoc | undefined;
    if (!holding || holding.artworkId !== artworkId) throw new NotFoundException();
    // Owner check — only the artwork's artist may verify this return.
    const artworkSnap = await this.db.collection(Collections.artworks).doc(artworkId).get();
    const artwork = artworkSnap.data() as ArtworkDoc | undefined;
    if (!artwork || artwork.artistId !== req.authUser.uid) throw new NotFoundException();

    if (holding.artistReturnRequestedAt) {
      // Replayed verify. Don't re-book, don't error — just confirm.
      return { verified: true, holdingId: body.holdingId };
    }
    if (!holding.returnRazorpayOrderId || holding.returnRazorpayOrderId !== body.razorpayOrderId) {
      throw new BadRequestException({
        type: "about:blank",
        title: "This payment doesn't match the return quote on file.",
        status: 400,
        code: "order_mismatch",
      });
    }

    const signatureOk = this.razorpay.verifyCheckoutSignature({
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      signature: body.razorpaySignature,
    });
    if (!signatureOk) {
      throw new BadRequestException({
        type: "about:blank",
        title: "Payment signature could not be verified.",
        status: 400,
        code: "bad_signature",
      });
    }

    // Re-read the order over our authenticated connection: a signature
    // only proves the payload came from Razorpay, not that the order is
    // currently paid for the right amount.
    const rpOrder = await this.razorpay.fetchOrder(body.razorpayOrderId);
    if (rpOrder.status !== "paid" || rpOrder.amount_paid !== (holding.returnShippingTotalPaise ?? 0)) {
      throw new BadRequestException({
        type: "about:blank",
        title: "Payment hasn't settled with Razorpay yet — give it a moment and try again.",
        status: 400,
        code: "not_paid_yet",
      });
    }

    // Stamp the holding BEFORE booking so a Shiprocket outage doesn't
    // strand the artist on a paid but unrequested return — admin can
    // rebook from the console. The webhook controller won't double-book
    // because `return-<holdingId>` is the shared reference.
    await holdingSnap.ref.update({
      artistReturnRequestedAt: FieldValue.serverTimestamp(),
      returnRazorpayPaymentId: body.razorpayPaymentId,
    });

    // Fire-and-forget: the booking either succeeds or an admin rebooks.
    void bookReturnShipment(this.db, body.holdingId).catch((error) => {
      console.error(
        JSON.stringify({
          event: "shiprocket.return.failed",
          holdingId: body.holdingId,
          error: String(error),
        }),
      );
    });

    return { verified: true, holdingId: body.holdingId };
  }

  /**
   * Settlements the artist is party to, newest first. Shares the admin
   * SettlementView shape — same fields the admin dashboard reads — but
   * filtered to this artist's rows and with payoutMethod stripped (the
   * artist knows their own bank; the field exists for the admin audit
   * trail, not for the artist's screen).
   *
   * 9 Nov 2026 — mobile was deriving settlements client-side by walking
   * the artist's orders, which meant admin adjustments (holdback, manual
   * mark-paid for royalty rows, dispute reversals) were invisible to the
   * artist. This endpoint makes the ledger the one source of truth.
   */
  @Roles("artist")
  @Get("artist/settlements")
  async settlements(@Req() req: AuthenticatedRequest) {
    const all = await listSettlements(this.db);
    const mine = all.filter((s) => s.artistId === req.authUser.uid);
    return {
      settlements: mine.map(({ payoutMethod: _ignored, ...rest }) => rest),
    };
  }

  @Roles("artist")
  @Post("artist/artworks/:id/sold-elsewhere")
  async soldElsewhere(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const rates = await this.rates();
    try {
      const result = await markSoldElsewhere(this.db, { artistId: req.authUser.uid, artworkId: id, rates });
      this.bust(id, req.authUser.uid);
      const artwork = await getArtistArtwork(this.db, req.authUser.uid, id, rates);
      return { ...result, artwork };
    } catch (error) {
      if (error instanceof ArtistArtworkError) {
        if (error.message.startsWith("No artwork")) throw notFound();
        throw new BadRequestException({ type: "about:blank", title: error.message, status: 409, code: "conflict" });
      }
      if (error instanceof IllegalTransitionError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
      throw error;
    }
  }

  @Roles("artist")
  @Get("artist/artworks/:id")
  async one(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    const artwork = await getArtistArtwork(this.db, req.authUser.uid, id, await this.rates());
    if (!artwork) throw notFound();
    return artwork;
  }

  @Roles("artist")
  @Post("artist/artworks")
  async submit(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(submitArtworkSchema)) body: SubmitArtworkBody) {
    // Review-mode submissions need KYC + the parts the platform needs to
    // actually ship + settle. Drafts don't. The backend check mirrors the
    // UI gate (owner-reported 31 Oct 2026: the frontend-only guard could
    // be bypassed by hitting the API directly).
    if (body.mode !== "draft") {
      await this.assertListingReady(req.authUser.uid);
      this.assertWeightOnSubmit(body);
    }
    const rates = await this.rates();
    const result = await submitArtwork({ db: this.db, artistId: req.authUser.uid, ...body, rates });
    this.bust(result.artworkId, req.authUser.uid);
    if (body.mode !== "draft") void this.emails.artworkSubmitted(result.artworkId, req.authUser.uid, body.title).catch(this.emails.swallow("submitted mail"));
    const artwork = await getArtistArtwork(this.db, req.authUser.uid, result.artworkId, rates);
    return artwork ?? result;
  }

  private async assertListingReady(uid: string): Promise<void> {
    const issues = await listingReadinessIssues(this.db, uid);
    if (issues.length === 0) return;
    const first = issues[0]!;
    throw new BadRequestException({
      type: "about:blank",
      title: listingReadinessMessage(first),
      status: 400,
      code: `listing_not_ready:${first}`,
      issues,
    });
  }

  private assertWeightOnSubmit(body: SubmitArtworkBody): void {
    const weight = body.physical?.weightKg;
    if (!weight || weight <= 0) {
      throw new BadRequestException({
        type: "about:blank",
        title: "Enter the artwork's weight in kg before submitting — the courier needs it to price the shipment.",
        status: 400,
        code: "weight_missing",
      });
    }
  }

  @Roles("artist")
  @Patch("artist/artworks/:id")
  async update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(updateArtworkSchema)) body: UpdateArtworkBody) {
    // Promoting a draft to review follows the same readiness rules as submit.
    if (body.mode === "review") {
      await this.assertListingReady(req.authUser.uid);
    }
    const rates = await this.rates();
    try {
      await updateArtwork(this.db, { artistId: req.authUser.uid, artworkId: id, patch: body, rates });
    } catch (error) {
      if (error instanceof ArtistArtworkError) {
        if (error.message.startsWith("No artwork")) throw notFound();
        throw new BadRequestException({ type: "about:blank", title: error.message, status: 400, code: "artwork_not_editable" });
      }
      if (error instanceof IllegalTransitionError) {
        throw new BadRequestException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
      }
      throw error;
    }
    this.bust(id, req.authUser.uid);
    const artwork = await getArtistArtwork(this.db, req.authUser.uid, id, rates);
    if (!artwork) throw notFound();
    if (body.mode === "review" && artwork.status === "pending_approval") {
      void this.emails.artworkSubmitted(id, req.authUser.uid, artwork.title).catch(this.emails.swallow("submitted mail"));
    }
    return artwork;
  }

  // --- NFC tag (NFC_IMPLEMENTATION.md §4.1, §4.2) ---------------------------------
  // The artist who made the piece, or the aggregator currently holding it, may
  // call these; nfc.ts checks which (a bare @Roles can't say "this artwork").

  /** Before the app writes or locks a chip: is that allowed for this chip? Changes nothing. Saves overwriting another piece's unlocked chip, or locking the wrong one. */
  @Roles("artist", "aggregator")
  // Pre-launch audit M2 (14 Nov 2026) — lowered from 20/min. NTAG213 UIDs
  // are not uniformly random; an authenticated artist could at the higher
  // rate probe tag-already-bound collisions across many artworks. A real
  // artist locking real pieces hits this endpoint 1-2 times per piece,
  // nowhere near 5/min.
  @Throttle({ sustained: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post("artist/artworks/:id/nfc/check")
  nfcCheck(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(checkNfcInputSchema)) body: CheckNfcInput): Promise<NfcCheckDto> {
    return checkNfcTag(this.db, { artworkId: id, tagUid: body.tagUid, intent: body.intent, actor: { uid: req.authUser.uid, role: req.authUser.role } });
  }

  /** The app wrote the URL to a chip and read this UID off it. Same chip again is a no-op; a different one replaces it until the lock. */
  @Roles("artist", "aggregator")
  // Linking is the actual bind — same argument as nfcCheck above but even
  // more aggressive because a successful link is irreversible without an
  // admin unlink. Audit M2 (14 Nov 2026).
  @Throttle({ sustained: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post("artist/artworks/:id/nfc/link")
  async nfcLink(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(tagUidInputSchema)) body: TagUidInput): Promise<NfcStateDto> {
    const result = await linkNfcTag(this.db, { artworkId: id, tagUid: body.tagUid, actor: { uid: req.authUser.uid, role: req.authUser.role } });
    if (result.changed) this.bust(id, result.artistId);
    return nfcStateViewOf(result);
  }

  /** The app flipped the chip's lock bytes, having re-read the UID. Irreversible. */
  @Roles("artist", "aggregator")
  @HttpCode(200)
  @Post("artist/artworks/:id/nfc/lock")
  async nfcLock(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(tagUidInputSchema)) body: TagUidInput): Promise<NfcStateDto> {
    try {
      const result = await lockNfcTag(this.db, { artworkId: id, tagUid: body.tagUid, actor: { uid: req.authUser.uid, role: req.authUser.role } });
      if (result.changed) this.bust(id, result.artistId);
      return nfcStateViewOf(result);
    } catch (error) {
      // §13: a lock that fails is worth a look, whichever side it fails on.
      if (error instanceof NfcError) Sentry.captureException(error, { level: "warning", tags: { artworkId: id, tagUid: body.tagUid, step: error.code } });
      throw error;
    }
  }

  /** The app reporting a link or lock that failed on the phone, so it reaches Sentry with the same tags as a server-side failure (§13). */
  @Roles("artist", "aggregator")
  @Throttle({ sustained: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @Post("artist/artworks/:id/nfc/failure")
  nfcFailure(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(reportNfcFailureInputSchema)) body: ReportNfcFailureInput): void {
    Sentry.captureMessage(`NFC ${body.step} failed: ${body.message || "no detail"}`, {
      level: "error",
      tags: { artworkId: id, step: body.step, source: "app", ...(body.tagUid ? { tagUid: body.tagUid } : {}) },
      user: { id: req.authUser.uid },
    });
  }

  @Roles("admin")
  @Post("admin/artworks/:id/approve")
  async approve(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(approveSchema)) body: ApproveBody) {
    const before = await this.artworkOf(id);
    if (!before) throw notFound();
    // Idempotent: a retried approval of a live piece is a no-op, not a 500.
    if (before.listing?.status === "marketplace") return { status: "marketplace" };
    try {
      await setArtworkRarity(this.db, id, body.rarity, req.authUser.uid);
      await approveArtwork(this.db, id, req.authUser.uid);
    } catch (error) {
      if (error instanceof ArtistArtworkError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 400, code: "rank_required" });
      if (error instanceof IllegalTransitionError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
      throw error;
    }
    this.cache.clear();
    const artwork = await this.artworkOf(id);
    if (artwork) void this.emails.artworkApproved(id, artwork.artistId, artwork.title, artwork.coaCertificateNumber).catch(this.emails.swallow("approved mail"));
    return { status: "marketplace" };
  }

  @Roles("admin")
  @Post("admin/artworks/:id/reject")
  async reject(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(rejectSchema)) body: RejectBody) {
    const before = await this.artworkOf(id);
    if (!before) throw notFound();
    if (before.listing?.status === "returned") return { status: "returned" };
    try {
      await rejectArtwork(this.db, id, body.reason, req.authUser.uid);
    } catch (error) {
      if (error instanceof IllegalTransitionError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
      if (error instanceof ArtistArtworkError) throw new BadRequestException({ type: "about:blank", title: error.message, status: 400, code: "bad_request" });
      throw error;
    }
    this.cache.clear();
    const artwork = await this.artworkOf(id);
    if (artwork) void this.emails.artworkRejected(id, artwork.artistId, artwork.title, body.reason).catch(this.emails.swallow("rejected mail"));
    return { status: "returned" };
  }
}
