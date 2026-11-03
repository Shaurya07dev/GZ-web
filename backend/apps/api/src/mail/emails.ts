// The service behind every email: look up what is needed, write the email with
// its template, record the in-app copy, hand it to the Mailer. Callers `void`
// these from the request path, so a mail failure is logged and never becomes an
// API error.
//
// The words live in templates.ts and the look in layout.ts. This file is the
// plumbing, and the place where each email's idempotency key is decided: the key
// is what stops a retried request or a duplicate webhook from sending twice, so
// an email that can legitimately happen again (a second rejection, a resent
// link) carries something that changes with each occurrence.

import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  Collections,
  readNotificationPreferences,
  recordNotifications,
  type AggregatorHoldingDoc,
  type AggregatorRemittanceDoc,
  type AggregatorSaleDoc,
  type ArtworkDoc,
  type BlogDoc,
  type Db,
  type HoldingReportRow,
  type OrderDoc,
  type PhysicalCoaRequestDoc,
  type ReservationIntentDoc,
  type UserDoc,
  type WalletTopupDoc,
} from "@galleryzone/db";
import type { OrderStatus } from "@galleryzone/domain";
import type { AppEnv } from "@galleryzone/config";
import { DB, ENV } from "../db.module.ts";
import { renderEmail } from "./layout.ts";
import { Mailer } from "./mailer.ts";
import { PushSender } from "./push.ts";
import { asText } from "./rich.ts";
import * as T from "./templates.ts";

export { inr } from "./templates.ts";

/** Pulls the oobCode out of a Firebase action link so the email can point at OUR page, not Firebase's handler. */
export function oobCodeOf(actionLink: string): string | null {
  try {
    return new URL(actionLink).searchParams.get("oobCode");
  } catch {
    return null;
  }
}

/** A one-time link is not kept in the in-app inbox: it goes to whoever typed the address, and works once. */
const NOT_IN_INBOX = ["password-reset/", "verify-email/"];

/** A key part that changes every time, for emails that can legitimately happen again. */
const again = (): string => Date.now().toString(36);

@Injectable()
export class Emails {
  private readonly logger = new Logger(Emails.name);
  private readonly ctx: T.Ctx;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) env: AppEnv,
    private readonly mailer: Mailer,
    private readonly push: PushSender,
  ) {
    this.ctx = { site: (process.env.PUBLIC_SITE_URL || env.corsOrigins[0] || "https://www.galleryzone.art").replace(/\/$/, "") };
  }

  // ── Plumbing ──────────────────────────────────────────────────────────

  private async read<D>(collection: string, id: string): Promise<D | undefined> {
    return (await this.db.collection(collection).doc(id).get()).data() as D | undefined;
  }

  private async user(uid: string): Promise<(UserDoc & { uid: string }) | null> {
    const doc = await this.read<UserDoc>(Collections.users, uid);
    return doc ? { uid, ...doc } : null;
  }

  private artwork(artworkId: string): Promise<ArtworkDoc | undefined> {
    return this.read<ArtworkDoc>(Collections.artworks, artworkId);
  }

  private async admins(): Promise<string[]> {
    const snap = await this.db.collection(Collections.users).where("role", "==", "admin").get();
    return snap.docs.map((d) => (d.data() as UserDoc).email).filter(Boolean);
  }

  /** A CTA on our own site, as a path; anything else isn't kept in the inbox. */
  private inAppPath(url: string | undefined): string | null {
    if (!url || !url.startsWith(this.ctx.site) || url.includes("oobCode")) return null;
    return url.slice(this.ctx.site.length) || "/";
  }

  /**
   * Writes the email, records its in-app copy FIRST (so a mail-provider outage
   * can't lose it), then sends the mail and fires a mobile push alongside.
   * Nothing is sent when there is nobody to send to or the template had
   * nothing to say.
   *
   * Push notifications piggy-back on every in-app-visible mail: same key, same
   * recipients, same first paragraph as the body. The one-time account links
   * (password reset, email verify) are deliberately skipped because they go
   * to the typed address and don't belong to any device yet. [PushSender]
   * honours the recipient's `pushEnabled` preference and silently no-ops
   * without Firebase credentials, so no transactional flow fails on a push
   * failure.
   */
  private async deliver(key: string, to: string | string[], content: T.Content | null): Promise<void> {
    if (!content) return;
    const recipients = [...new Set((Array.isArray(to) ? to : [to]).filter(Boolean))];
    if (!recipients.length) return;
    const { layout } = content;
    const inApp = !NOT_IN_INBOX.some((p) => key.startsWith(p));
    if (inApp) {
      await recordNotifications(this.db, {
        key,
        emails: recipients,
        title: content.subject,
        body: asText(layout.paragraphs[0] ?? ""),
        url: this.inAppPath(layout.cta?.url),
      }).catch((error: unknown) => this.logger.warn(`in-app notification ${key} failed: ${error instanceof Error ? error.message : String(error)}`));
    }
    const { html, text } = renderEmail(this.ctx, layout);
    await this.mailer.send({ to: recipients, subject: content.subject, html, text, idempotencyKey: key, replyTo: content.replyTo, tag: key.split("/")[0] });
    if (inApp) {
      // Push mirrors the in-app notification. Non-blocking: the mail has
      // already landed and PushSender swallows its own errors, but awaiting
      // it in the request path would slow transactional flows for no gain.
      void this.push
        .sendToEmails(this.db, recipients, {
          title: content.subject,
          body: asText(layout.paragraphs[0] ?? ""),
          url: this.inAppPath(layout.cta?.url),
        })
        .catch((error: unknown) =>
          this.logger.warn(`push ${key} failed: ${error instanceof Error ? error.message : String(error)}`),
        );
    }
  }

  // ── Account ───────────────────────────────────────────────────────────

  async welcome(uid: string, verifyUrl: string | null) {
    const u = await this.user(uid);
    if (!u) return;
    await this.deliver(`welcome/${uid}`, u.email, T.welcome({ name: u.name, role: u.role, verifyUrl }, this.ctx));
  }

  /**
   * The confirmation link, sent again on request. It must not share the
   * welcome's key: each resend carries a fresh link, so the body differs, and
   * the provider refuses a reused key with a different body (409), which meant
   * "resend" sent nothing for the first 24 hours.
   */
  async resendVerification(uid: string, verifyUrl: string) {
    const u = await this.user(uid);
    if (!u) return;
    await this.deliver(`verify-email/${uid}/${again()}`, u.email, T.verifyEmail({ role: u.role, verifyUrl }));
  }

  async passwordReset(email: string, name: string | null, resetUrl: string) {
    await this.deliver(`password-reset/${email}/${again()}`, email, T.passwordReset({ name, resetUrl }));
  }

  async accountStatusChanged(input: { userId: string; status: string }) {
    const user = await this.user(input.userId);
    if (!user) return;
    await this.deliver(`account-${input.status}/${input.userId}/${again()}`, user.email, T.accountStatus({ status: input.status, role: user.role }));
  }

  /** A changed payout destination always gets mailed: the real owner has to hear about it even when someone else made the change. */
  async bankAccountChanged(input: { userId: string; maskedAccount: string | null }) {
    const user = await this.user(input.userId);
    if (!user) return;
    await this.deliver(`bank-changed/${input.userId}/${again()}`, user.email, T.bankAccountChanged({ maskedAccount: input.maskedAccount, role: user.role }, this.ctx));
  }

  async deactivationRequested(input: { userId: string; reason: string }) {
    const [user, admins] = await Promise.all([this.user(input.userId), this.admins()]);
    if (user) await this.deliver(`deactivation-requested/${input.userId}`, user.email, T.deactivationRequested({ role: user.role }));
    await this.deliver(`deactivation-requested-admin/${input.userId}`, admins, T.deactivationRequestedAdmin({ name: user?.name ?? input.userId, reason: input.reason }, this.ctx));
  }

  async deactivationDecided(input: { userId: string; approved: boolean; note?: string | undefined }) {
    const user = await this.user(input.userId);
    if (!user) return;
    await this.deliver(`deactivation-${input.approved ? "approved" : "rejected"}/${input.userId}`, user.email, T.deactivationDecided({ approved: input.approved, note: input.note, role: user.role }));
  }

  // ── Artworks ──────────────────────────────────────────────────────────

  /** Keyed per submission: an artist who is returned a piece and resubmits it the same day must still reach the review queue. */
  async artworkSubmitted(artworkId: string, artistId: string, title: string) {
    const [artist, admins] = await Promise.all([this.user(artistId), this.admins()]);
    const n = again();
    if (artist) await this.deliver(`artwork-submitted/${artworkId}/${n}`, artist.email, T.artworkSubmitted({ title }, this.ctx));
    await this.deliver(`artwork-submitted-admin/${artworkId}/${n}`, admins, T.artworkSubmittedAdmin({ title, artistName: artist?.name ?? "An artist" }, this.ctx));
  }

  async artworkApproved(artworkId: string, artistId: string, title: string, certificateNumber: string | null) {
    const artist = await this.user(artistId);
    if (!artist) return;
    await this.deliver(`artwork-approved/${artworkId}`, artist.email, T.artworkApproved({ title, artworkId, certificateNumber }, this.ctx));
  }

  async artworkRejected(artworkId: string, artistId: string, title: string, reason: string) {
    const artist = await this.user(artistId);
    if (!artist) return;
    await this.deliver(`artwork-rejected/${artworkId}/${again()}`, artist.email, T.artworkRejected({ title, artworkId, reason }, this.ctx));
  }

  /** An admin pulling a live piece off the marketplace was entirely silent; nothing called this until now. */
  async artworkDelisted(input: { artworkId: string; reason?: string | undefined }) {
    const artwork = await this.artwork(input.artworkId);
    const artist = artwork ? await this.user(artwork.artistId) : null;
    if (!artwork || !artist) return;
    await this.deliver(`artwork-delisted/${input.artworkId}/${again()}`, artist.email, T.artworkDelisted({ title: artwork.title, reason: input.reason }, this.ctx));
  }

  /**
   * A tag that was linked but never locked (NFC_IMPLEMENTATION.md §13). Sent at
   * 48 hours and again at 7 days; the key carries the link time, so a re-link
   * starts the clock (and the mails) afresh. "nudge" is an admin chasing it by
   * hand, and is always sent.
   */
  async nfcLockReminder(input: { artworkId: string; artistId: string; title: string; stage: "48h" | "7d" | "nudge"; linkedAt: Date | null }) {
    const artist = await this.user(input.artistId);
    if (!artist) return;
    const key = input.stage === "nudge" ? `nfc-lock-nudge/${input.artworkId}/${again()}` : `nfc-lock-reminder/${input.artworkId}/${input.stage}/${input.linkedAt?.getTime() ?? 0}`;
    await this.deliver(key, artist.email, T.nfcLockReminder({ title: input.title, stage: input.stage, linked: input.linkedAt !== null }, this.ctx));
  }

  async blogDecided(input: { blogId: string; approved: boolean; note?: string | null | undefined }) {
    const blog = await this.read<BlogDoc>(Collections.blogs, input.blogId);
    const author = blog ? await this.user(blog.authorId) : null;
    if (!blog || !author) return;
    await this.deliver(`blog-${input.approved ? "published" : "returned"}/${input.blogId}/${input.approved ? "" : again()}`, author.email, T.blogDecided({ title: blog.title, approved: input.approved, note: input.note ?? null, slug: blog.slug }, this.ctx));
  }

  async externalSaleFeeDecided(input: { penaltyId: string; artistId: string; title: string; amountPaise: number; waived: boolean; note?: string | undefined }) {
    const artist = await this.user(input.artistId);
    if (!artist) return;
    await this.deliver(`external-fee-${input.waived ? "waived" : "approved"}/${input.penaltyId}`, artist.email, T.externalSaleFeeDecided({ title: input.title, amountPaise: input.amountPaise, waived: input.waived, note: input.note }, this.ctx));
  }

  // ── Orders ────────────────────────────────────────────────────────────

  async orderPaid(input: { orderId: string; customerId: string; artistId: string; title: string; totalPaise: number; artistNetPaise: number }) {
    const [buyer, artist] = await Promise.all([this.user(input.customerId), this.user(input.artistId)]);
    if (buyer) await this.deliver(`order-paid-buyer/${input.orderId}`, buyer.email, T.orderPaidBuyer({ orderId: input.orderId, title: input.title, totalPaise: input.totalPaise }, this.ctx));
    if (artist) await this.deliver(`order-paid-artist/${input.orderId}`, artist.email, T.orderPaidArtist({ title: input.title, artistNetPaise: input.artistNetPaise }, this.ctx));
  }

  /**
   * Keyed to the real OrderStatus values. "pending" and "paid" are deliberately
   * absent (orderPaid covers that moment), and "packed" goes to the buyer only.
   * The courier hand-over and the delivery used to have emails of their own that
   * nothing ever called; their words now live in the transit and delivered ones.
   */
  async orderStatus(input: { orderId: string; customerId: string; artistId: string | null; title: string; status: OrderStatus }) {
    const quote = input.status === "transit" ? (await this.read<OrderDoc>(Collections.orders, input.orderId))?.shippingQuote : null;
    const facts = { orderId: input.orderId, title: input.title, status: input.status, carrier: quote?.carrier ?? null, estimatedDays: quote?.estimatedDeliveryDays ?? null };
    const buyer = await this.user(input.customerId);
    if (buyer) await this.deliver(`order-${input.status}-buyer/${input.orderId}`, buyer.email, T.orderStatusBuyer(facts, this.ctx));
    const artist = input.artistId ? await this.user(input.artistId) : null;
    if (artist) await this.deliver(`order-${input.status}-artist/${input.orderId}`, artist.email, T.orderStatusArtist(facts, this.ctx));
  }

  /** The buyer got as far as the gateway and it didn't go through. */
  async paymentFailed(input: { orderId: string; customerId: string; title: string; totalPaise: number }) {
    const buyer = await this.user(input.customerId);
    if (!buyer) return;
    await this.deliver(`payment-failed/${input.orderId}`, buyer.email, T.paymentFailed({ orderId: input.orderId, title: input.title, totalPaise: input.totalPaise }, this.ctx));
  }

  /**
   * Opt-out reminder: anyone with notificationPreferences.abandonedCart === false
   * is skipped. The caller must fire it once per cart entry (the key encodes the
   * entry). Nothing calls it yet: it needs a scheduled job and an owner's go-ahead.
   */
  async abandonedCart(input: { uid: string; firstArtworkTitle: string; extraCount: number; cartEntryKey: string }) {
    const user = await this.user(input.uid);
    if (!user) return;
    if (!(await readNotificationPreferences(this.db, input.uid)).abandonedCart) return;
    await this.deliver(`abandoned-cart/${input.uid}/${input.cartEntryKey}`, user.email, T.abandonedCart({ title: input.firstArtworkTitle, extraCount: input.extraCount }, this.ctx));
  }

  // ── Ownership and certificates ────────────────────────────────────────

  async transferInvite(input: { transferId: string; toEmail: string; toName: string; fromName: string; title: string; kind: string }) {
    await this.deliver(`transfer-invite/${input.transferId}`, input.toEmail, T.transferInvite({ transferId: input.transferId, toName: input.toName, fromName: input.fromName, title: input.title, kind: input.kind }, this.ctx));
  }

  /** Tells the person who made the offer. */
  async transferAccepted(input: { transferId: string; artworkId: string; title: string; toName: string; kind: string; fromUserId: string | null }) {
    const sender = input.fromUserId ? await this.user(input.fromUserId) : null;
    if (!sender) return;
    await this.deliver(`transfer-accepted/${input.transferId}`, sender.email, T.transferAccepted({ artworkId: input.artworkId, title: input.title, toName: input.toName, kind: input.kind, role: sender.role }, this.ctx));
  }

  /** The invitee said no: tell the person who made the offer. */
  async transferDeclined(input: { transferId: string; artworkId: string; title: string; toName: string; kind: string; fromUserId: string | null }) {
    const sender = input.fromUserId ? await this.user(input.fromUserId) : null;
    if (!sender) return;
    await this.deliver(`transfer-declined/${input.transferId}`, sender.email, T.transferDeclined({ artworkId: input.artworkId, title: input.title, toName: input.toName, kind: input.kind, role: sender.role }, this.ctx));
  }

  /** The sender withdrew: tell the person who was invited, who may not have an account yet. */
  async transferCancelled(input: { transferId: string; toEmail: string | null; fromName: string; title: string; kind: string }) {
    if (!input.toEmail) return;
    await this.deliver(`transfer-cancelled/${input.transferId}`, input.toEmail, T.transferCancelled({ title: input.title, fromName: input.fromName, kind: input.kind }));
  }

  async physicalCoaRequested(input: { requestId: string; artistId: string; title: string; requestedByName: string }) {
    const artist = await this.user(input.artistId);
    if (!artist) return;
    await this.deliver(`coa-request/${input.requestId}`, artist.email, T.physicalCoaRequested({ title: input.title, requestedByName: input.requestedByName }, this.ctx));
  }

  /** The other half of the request: whoever asked hears that the printed certificate is on its way. */
  async physicalCoaDispatched(requestId: string) {
    const request = await this.read<PhysicalCoaRequestDoc>(Collections.physicalCoaRequests, requestId);
    if (!request) return;
    const [artwork, requester] = await Promise.all([this.artwork(request.artworkId), this.user(request.requestedByUserId)]);
    if (!artwork || !requester) return;
    await this.deliver(`coa-dispatched/${requestId}`, requester.email, T.physicalCoaDispatched({ title: artwork.title, courierRef: request.courierRef, role: requester.role }, this.ctx));
  }

  // ── Compliance and agreements ─────────────────────────────────────────

  /**
   * GST and KYC decisions both gate something: KYC blocks payouts outright, and
   * an aggregator can't reserve a piece until their GSTIN is approved (client,
   * 30 Sep 2026). Keyed per decision, so a second rejection after a resubmission
   * is a new email and not a duplicate.
   */
  async complianceDecided(input: { userId: string; kind: "gst" | "kyc"; decisionId: string; approved: boolean; reason?: string | undefined }) {
    const user = await this.user(input.userId);
    if (!user) return;
    await this.deliver(`${input.kind}-${input.approved ? "approved" : "rejected"}/${input.userId}/${input.decisionId}`, user.email, T.complianceDecided({ kind: input.kind, approved: input.approved, reason: input.reason, role: user.role }, this.ctx));
  }

  async mouSigned(input: { uid: string; party: "artist" | "aggregator"; version: string; signatureName: string; signedAt: Date }) {
    const user = await this.user(input.uid);
    if (!user) return;
    await this.deliver(`mou-signed/${input.uid}/${input.party}/${input.version}`, user.email, T.mouSigned({ party: input.party, version: input.version, signatureName: input.signatureName, signedAt: input.signedAt, name: user.name }, this.ctx));
  }

  // ── Aggregators ───────────────────────────────────────────────────────

  /**
   * A physical artwork leaves the artist's studio for a partner gallery. Both
   * sides need this in writing: the artist because their work is moving, the
   * aggregator because it is the record of the terms and the advance.
   */
  async aggregatorReserved(input: { holdingId: string; artworkId: string; aggregatorId: string; advanceAmountPaise: number; displayPricePaise: number; expiresAt: Date }) {
    const artwork = await this.artwork(input.artworkId);
    if (!artwork?.artistId) return;
    const [artist, aggregator] = await Promise.all([this.user(artwork.artistId), this.user(input.aggregatorId)]);
    if (artist) {
      await this.deliver(`holding-reserved-artist/${input.holdingId}`, artist.email, T.holdingReservedArtist({ title: artwork.title, gallery: aggregator?.name ?? "a partner gallery", until: input.expiresAt, tagLocked: Boolean(artwork.nfcLockedAt) }, this.ctx));
    }
    if (aggregator) {
      await this.deliver(`holding-reserved-aggregator/${input.holdingId}`, aggregator.email, T.holdingReservedAggregator({ title: artwork.title, until: input.expiresAt, advancePaise: input.advanceAmountPaise, displayPricePaise: input.displayPricePaise }, this.ctx));
    }
  }

  /**
   * The same emails, for the route that pays by gateway first and creates the
   * holding afterwards (the website's). It only knows the holding's id, so it
   * reads the rest, and it sends the price warning too, which that route
   * never did. Safe to call from both the browser's verify and the webhook: the keys
   * are the holding's.
   */
  async holdingReservedById(holdingId: string) {
    const holding = await this.read<AggregatorHoldingDoc>(Collections.aggregatorHoldings, holdingId);
    if (!holding) return;
    await this.aggregatorReserved({ holdingId, artworkId: holding.artworkId, aggregatorId: holding.aggregatorId, advanceAmountPaise: holding.advanceAmountPaise, displayPricePaise: holding.displayPricePaise, expiresAt: holding.expiresAt.toDate() });
    if (holding.priceWarning && holding.sellingPricePaise) {
      await this.holdingPriceWarning({ holdingId, artworkId: holding.artworkId, aggregatorId: holding.aggregatorId, sellingPricePaise: holding.sellingPricePaise, offerSellingPricePaise: null });
    }
  }

  /** An aggregator priced a piece far above GalleryZone's offer. Allowed (client, 30 Sep 2026: no limit), but GalleryZone is told. */
  async holdingPriceWarning(input: { holdingId: string; artworkId: string; aggregatorId: string; sellingPricePaise: number; offerSellingPricePaise: number | null }) {
    const [artwork, aggregator, admins] = await Promise.all([this.artwork(input.artworkId), this.user(input.aggregatorId), this.admins()]);
    await this.deliver(`holding-price-warning/${input.holdingId}`, admins, T.holdingPriceWarning({ title: artwork?.title ?? "an artwork", aggregatorName: aggregator?.name ?? "An aggregator", sellingPricePaise: input.sellingPricePaise, offerPaise: input.offerSellingPricePaise, artworkId: input.artworkId }, this.ctx));
  }

  /** An aggregator wants to keep a piece past its window. GalleryZone decides each time. */
  async holdingExtensionRequested(input: { holdingId: string; artworkId: string; aggregatorId: string; assurance: string; expiresAt: Date }) {
    const [artwork, aggregator, admins] = await Promise.all([this.artwork(input.artworkId), this.user(input.aggregatorId), this.admins()]);
    await this.deliver(`holding-extension-requested/${input.holdingId}/${input.expiresAt.getTime()}`, admins, T.holdingExtensionRequested({ title: artwork?.title ?? "an artwork", aggregatorName: aggregator?.name ?? "An aggregator", until: input.expiresAt, assurance: input.assurance, artworkId: input.artworkId }, this.ctx));
  }

  async holdingExtensionDecided(input: { holdingId: string; artworkId: string; aggregatorId: string; approved: boolean; newExpiresAt: Date | null; note: string | null }) {
    const [artwork, aggregator] = await Promise.all([this.artwork(input.artworkId), this.user(input.aggregatorId)]);
    if (!aggregator) return;
    await this.deliver(`holding-extension-decided/${input.holdingId}/${input.approved ? "yes" : "no"}`, aggregator.email, T.holdingExtensionDecided({ title: artwork?.title ?? "your piece", approved: input.approved, newUntil: input.newExpiresAt, note: input.note }, this.ctx));
  }

  /** The window ended and the piece moved on. The advance is released the same day. */
  async holdingPeriodEnded(input: { holdingId: string; artworkId: string; aggregatorId: string; advancePaise: number }) {
    const [artwork, aggregator] = await Promise.all([this.artwork(input.artworkId), this.user(input.aggregatorId)]);
    if (!aggregator) return;
    await this.deliver(`holding-period-ended/${input.holdingId}`, aggregator.email, T.holdingPeriodEnded({ title: artwork?.title ?? "your piece", advancePaise: input.advancePaise }, this.ctx));
  }

  /** The aggregator sent an unsold piece back early. Both sides hear it. */
  async holdingReturned(holdingId: string) {
    const holding = await this.read<AggregatorHoldingDoc>(Collections.aggregatorHoldings, holdingId);
    if (!holding) return;
    const artwork = await this.artwork(holding.artworkId);
    const [aggregator, artist] = await Promise.all([this.user(holding.aggregatorId), artwork ? this.user(artwork.artistId) : null]);
    const title = artwork?.title ?? "your piece";
    if (aggregator) await this.deliver(`holding-returned-aggregator/${holdingId}`, aggregator.email, T.holdingReturnedAggregator({ title, advancePaise: holding.advanceAmountPaise }, this.ctx));
    if (artist) await this.deliver(`holding-returned-artist/${holdingId}`, artist.email, T.holdingReturnedArtist({ title, gallery: aggregator?.name ?? "A gallery" }, this.ctx));
  }

  /** A sale at a gallery: the aggregator gets the record, the artist hears their piece sold. */
  async saleRecorded(saleId: string) {
    const sale = await this.read<AggregatorSaleDoc>(Collections.aggregatorSales, saleId);
    if (!sale) return;
    const [holding, artwork] = await Promise.all([this.read<AggregatorHoldingDoc>(Collections.aggregatorHoldings, sale.holdingId), this.artwork(sale.artworkId)]);
    const [aggregator, artist] = await Promise.all([holding ? this.user(holding.aggregatorId) : null, artwork ? this.user(artwork.artistId) : null]);
    const title = artwork?.title ?? "your piece";
    if (aggregator) {
      await this.deliver(`sale-recorded-aggregator/${saleId}`, aggregator.email, T.saleRecordedAggregator({ title, soldPricePaise: sale.soldPricePaise, buyerName: sale.buyerName, cash: sale.paymentRoute === "cash_at_premises", remitBy: sale.remitDueAt?.toDate() ?? null }, this.ctx));
    }
    if (artist) await this.deliver(`sale-recorded-artist/${saleId}`, artist.email, T.saleRecordedArtist({ title, gallery: aggregator?.name ?? "A gallery" }, this.ctx));
  }

  async holdingReportFiled(report: HoldingReportRow) {
    await this.deliver(`holding-report-filed/${report.id}`, await this.admins(), T.holdingReportFiledAdmin({ title: report.artworkTitle, aggregatorName: report.aggregatorName, artistName: report.artistName, issueType: report.issueType, description: report.description }, this.ctx));
  }

  async holdingReportResolved(report: HoldingReportRow) {
    await this.deliver(`holding-report-resolved/${report.id}`, report.aggregatorEmail, T.holdingReportResolved({ title: report.artworkTitle, resolutionNote: report.resolutionNote }, this.ctx));
  }

  // ── Money in ──────────────────────────────────────────────────────────

  /** A receipt for a wallet top-up. Called from the browser's verify, the simulator and the webhook; the key is the top-up's. */
  async walletTopupReceived(topupId: string) {
    const topup = await this.read<WalletTopupDoc>(Collections.walletTopups, topupId);
    if (!topup || topup.status !== "paid") return;
    const user = await this.user(topup.userId);
    if (!user) return;
    await this.deliver(`topup-received/${topupId}`, user.email, T.walletTopupReceived({ amountPaise: topup.amountPaise, paidAt: topup.paidAt?.toDate() ?? new Date(), method: topup.method }, this.ctx));
  }

  async remittanceReceived(remittanceId: string) {
    const remittance = await this.read<AggregatorRemittanceDoc>(Collections.aggregatorRemittances, remittanceId);
    if (!remittance || remittance.status !== "paid") return;
    const user = await this.user(remittance.aggregatorId);
    if (!user) return;
    await this.deliver(`remittance-received/${remittanceId}`, user.email, T.remittanceReceived({ amountPaise: remittance.amountPaise, paidAt: remittance.paidAt?.toDate() ?? new Date(), saleCount: remittance.saleIds.length, method: remittance.method }, this.ctx));
  }

  /** The reservation was paid but couldn't be completed, and the money is going back. */
  async reservationRefunded(intentId: string) {
    const intent = await this.read<ReservationIntentDoc>(Collections.reservationIntents, intentId);
    if (!intent) return;
    const [aggregator, artwork] = await Promise.all([this.user(intent.aggregatorId), this.artwork(intent.artworkId)]);
    if (!aggregator) return;
    await this.deliver(`reservation-refunded/${intentId}`, aggregator.email, T.reservationRefunded({ title: artwork?.title ?? null, amountPaise: intent.totalPayablePaise }, this.ctx));
  }

  /** The automatic refund failed: somebody has paid and has nothing, so a person has to finish it. */
  async refundFailed(intentId: string, reason: string) {
    const intent = await this.read<ReservationIntentDoc>(Collections.reservationIntents, intentId);
    if (!intent) return;
    const [aggregator, admins] = await Promise.all([this.user(intent.aggregatorId), this.admins()]);
    await this.deliver(`refund-failed/${intentId}`, admins, T.refundFailedAdmin({ intentId, aggregatorName: aggregator?.name ?? intent.aggregatorId, amountPaise: intent.totalPayablePaise, reason }, this.ctx));
  }

  // ── Money out ─────────────────────────────────────────────────────────

  async withdrawalRequested(input: { withdrawalId: string; userId: string; amountPaise: number }) {
    const [user, admins] = await Promise.all([this.user(input.userId), this.admins()]);
    if (user) await this.deliver(`withdrawal-requested/${input.withdrawalId}`, user.email, T.withdrawalRequested({ amountPaise: input.amountPaise, role: user.role }, this.ctx));
    await this.deliver(`withdrawal-requested-admin/${input.withdrawalId}`, admins, T.withdrawalRequestedAdmin({ name: user?.name ?? input.userId, amountPaise: input.amountPaise }, this.ctx));
  }

  async withdrawalDecided(input: { withdrawalId: string; userId: string; amountPaise: number; approved: boolean }) {
    const user = await this.user(input.userId);
    if (!user) return;
    await this.deliver(`withdrawal-${input.approved ? "approved" : "rejected"}/${input.withdrawalId}`, user.email, T.withdrawalDecided({ amountPaise: input.amountPaise, approved: input.approved, role: user.role }, this.ctx));
  }

  // ── Support ───────────────────────────────────────────────────────────

  /**
   * A ticket used to vanish into a queue: the person who raised it got no
   * acknowledgement, and admins only saw it if they happened to open the queue.
   * The admins' copy replies to the requester, so support can just hit reply.
   */
  async supportTicketRaised(input: { ticketId: string; userId: string; subject: string; message: string }) {
    const [user, admins] = await Promise.all([this.user(input.userId), this.admins()]);
    if (user) await this.deliver(`support-ack/${input.ticketId}`, user.email, T.supportAck({ subject: input.subject, role: user.role }, this.ctx));
    await this.deliver(`support-new-admin/${input.ticketId}`, admins, T.supportNewAdmin({ subject: input.subject, message: input.message, name: user?.name ?? input.userId, email: user?.email ?? null, role: user?.role ?? null }));
  }

  /** Any unexpected failure in a mail hook is logged here and never propagated. */
  swallow(label: string) {
    return (error: unknown) => this.logger.error(`${label}: ${String(error)}`);
  }
}
