// Every GalleryZone email, as a pure function: facts in, { subject, layout } out.
//
// Nothing here reads the database or sends anything, which is what lets the
// preview script and the check render every email with sample data, and lets
// the catalogue at the bottom be the single list of what the platform says to
// whom. emails.ts looks the facts up and sends; this file only writes.
//
// Writing rules: say what happened first, then what happens next, in plain
// words. Money in rupees, dates as "1 November 2026". Only claim what the
// code does (for example a held payout is not mentioned, because nothing in
// the platform holds one). Plain strings are text and are escaped once at
// render; use rich`...` with strong() for emphasis.

import type { OrderStatus } from "@galleryzone/domain";
import type { Audience, Layout, RenderContext } from "./layout.ts";
import { rich, strong } from "./rich.ts";

export type Ctx = RenderContext;

/**
 * security: account safety, always sent. transactional: a record of something
 * that happened or a decision, always sent. reminder: a nudge; the user can
 * switch the opt-out ones off.
 */
export type Category = "security" | "transactional" | "reminder";

export interface Content {
  subject: string;
  category: Category;
  layout: Layout;
  /** Where a reply should go when it is not the support address. */
  replyTo?: string;
}

export function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function longDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

const first = (name: string): string => name.trim().split(/\s+/)[0] || name;
const q = (title: string): string => `“${title}”`;
/** Artwork titles can be long; a subject line cannot. */
const short = (title: string, max = 60): string => (title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title);

export function audienceOf(role: string): Audience {
  return role === "customer" ? "collector" : role === "artist" || role === "aggregator" || role === "admin" ? role : "anyone";
}

/** Where each kind of account lands to see its own pieces. */
function collectionPath(role: string): string {
  return role === "artist" ? "/dashboard/coa-nfc" : role === "aggregator" ? "/aggregator/collection" : "/account/collection";
}
function profilePath(role: string): string {
  return role === "aggregator" ? "/aggregator/profile" : "/dashboard/profile";
}
function walletPath(role: string): string {
  return role === "aggregator" ? "/aggregator/wallet" : "/dashboard/wallet";
}

// ── Account and security ────────────────────────────────────────────────

export function welcome(i: { name: string; role: string; verifyUrl: string | null }, c: Ctx): Content {
  const roleLine: Record<string, string> = {
    artist: "You can now list your work, sign the artist agreement and start selling.",
    aggregator: "You can now browse the catalogue and reserve pieces for display.",
    customer: "You can now collect original artworks with a verifiable provenance record.",
  };
  const hello = first(i.name);
  return {
    subject: `Welcome to GalleryZone, ${hello}`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      preheader: i.verifyUrl ? "Confirm your email to finish setting up." : "Your account is ready.",
      heading: `Welcome, ${hello}`,
      paragraphs: [`Your GalleryZone account is ready. ${roleLine[i.role] ?? ""}`.trim(), ...(i.verifyUrl ? ["Please confirm your email address so we can reach you about orders and your account."] : [])],
      cta: i.verifyUrl ? { label: "Confirm my email", url: i.verifyUrl } : { label: "Open GalleryZone", url: c.site },
    },
  };
}

/** The link sent again on request. Not the welcome: a second welcome would be a strange thing to receive. */
export function verifyEmail(i: { role: string; verifyUrl: string }): Content {
  return {
    subject: "Confirm your email address",
    category: "security",
    layout: {
      audience: audienceOf(i.role),
      heading: "Confirm your email address",
      paragraphs: ["Use the button below to confirm this address for your GalleryZone account. We use it to reach you about orders and your account."],
      cta: { label: "Confirm my email", url: i.verifyUrl },
      footnote: "If you didn't ask for this, you can ignore this email.",
    },
  };
}

export function passwordReset(i: { name: string | null; resetUrl: string }): Content {
  return {
    subject: "Reset your GalleryZone password",
    category: "security",
    layout: {
      audience: "anyone",
      preheader: "This link works once and expires in an hour.",
      heading: "Reset your password",
      paragraphs: [`Hi${i.name ? ` ${first(i.name)}` : ""}, someone asked to reset the password for this account. If that was you, choose a new one below.`, "If you didn't ask for this, you can ignore this email. Your password stays the same."],
      cta: { label: "Choose a new password", url: i.resetUrl },
      footnote: "The link works once and expires after one hour.",
    },
  };
}

/**
 * Six-digit code sent during email sign-up. The code lives in [db/otp.ts] as
 * a one-time, 10-minute-TTL record; this mail is only its delivery. The
 * template deliberately shows the code in both the subject preheader and
 * the body so a glance at the inbox is enough on a phone.
 */
export function signupEmailOtp(i: { code: string; name: string | null }): Content {
  return {
    subject: `Your GalleryZone verification code is ${i.code}`,
    category: "security",
    layout: {
      audience: "anyone",
      preheader: `Code: ${i.code} (valid 10 minutes)`,
      heading: "Confirm your email",
      paragraphs: [
        `Hi${i.name ? ` ${first(i.name)}` : ""}, use this six-digit code to confirm your email on GalleryZone:`,
        rich`${strong(i.code)}`,
        "The code is valid for 10 minutes. Don't share it — GalleryZone will never ask you for it.",
      ],
      footnote: "If you didn't ask to sign up, you can ignore this email.",
    },
  };
}

/**
 * Six-digit code sent for password reset. Replaces the old link-based reset:
 * the user types the code into our own screen and chooses a new password
 * there, so a leaked link isn't a password change on its own.
 */
export function passwordResetOtp(i: { code: string; name: string | null }): Content {
  return {
    subject: `Your GalleryZone password reset code is ${i.code}`,
    category: "security",
    layout: {
      audience: "anyone",
      preheader: `Code: ${i.code} (valid 10 minutes)`,
      heading: "Reset your password",
      paragraphs: [
        `Hi${i.name ? ` ${first(i.name)}` : ""}, someone asked to reset the password on this GalleryZone account. If it was you, enter this six-digit code on the reset screen to choose a new password:`,
        rich`${strong(i.code)}`,
        "The code is valid for 10 minutes. If it wasn't you, ignore this email — your password stays the same.",
      ],
      footnote: "GalleryZone will never ask you for this code.",
    },
  };
}

export function accountStatus(i: { status: string; role: string }): Content | null {
  const copy: Record<string, { subject: string; heading: string; body: string }> = {
    suspended: { subject: "Your account has been suspended", heading: "Your account is suspended", body: "You won't be able to sign in while this is in place. Reply to this email if you think it's a mistake and we'll take another look." },
    blocked: { subject: "Your account has been blocked", heading: "Your account is blocked", body: "Access has been withdrawn. Reply to this email if you believe this is an error." },
    active: { subject: "Your account is active again", heading: "Welcome back", body: "Your account has been restored and you can sign in as normal." },
  };
  const k = copy[i.status];
  if (!k) return null;
  return { subject: k.subject, category: "security", layout: { audience: audienceOf(i.role), heading: k.heading, paragraphs: [k.body] } };
}

/** A changed payout destination is the classic account-takeover payload: the real owner has to hear about it. */
export function bankAccountChanged(i: { maskedAccount: string | null; role: string }, c: Ctx): Content {
  return {
    subject: "Your payout account was changed",
    category: "security",
    layout: {
      audience: audienceOf(i.role),
      preheader: "If this wasn't you, tell us straight away.",
      heading: "Your payout account was changed",
      paragraphs: [
        i.maskedAccount ? rich`Payouts will now go to the account ending ${strong(i.maskedAccount.replace(/^[•*\s]+/, ""))}.` : "The bank account on your profile has been removed, so payouts are on hold until you add one.",
        rich`${strong("If you didn't do this, reply to this email straight away")} and we'll freeze payouts while we look into it.`,
      ],
      cta: { label: "Check my profile", url: `${c.site}${profilePath(i.role)}` },
    },
  };
}

export function deactivationRequested(i: { role: string }): Content {
  return {
    subject: "We've received your deactivation request",
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: "Your request is with us",
      paragraphs: ["We'll review it and come back to you. Anything still in progress (a live listing, a piece with a gallery, an unpaid settlement) has to be closed out before an account can be deactivated."],
    },
  };
}

export function deactivationRequestedAdmin(i: { name: string; reason: string }, c: Ctx): Content {
  return {
    subject: `Deactivation requested by ${i.name}`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "Deactivation request",
      paragraphs: [rich`${strong(i.name)} asked to deactivate their account.`],
      note: { label: "Reason given", text: i.reason },
      cta: { label: "Review the request", url: `${c.site}/admin/moderation/deactivations` },
    },
  };
}

export function deactivationDecided(i: { approved: boolean; note?: string | undefined; role: string }): Content {
  return {
    subject: i.approved ? "Your account has been deactivated" : "We couldn't deactivate your account yet",
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: i.approved ? "Your account is deactivated" : "Your deactivation is on hold",
      paragraphs: [i.approved ? "Your account is closed. Your provenance records stay intact: every certificate you issued remains verifiable, because collectors rely on them." : "We can't close the account yet. Usually that means something is still open: a live listing, a piece out with a gallery, or an unsettled balance."],
      ...(i.note ? { note: { label: "Note from the reviewer", text: i.note } } : {}),
    },
  };
}

// ── Artworks (artists) ──────────────────────────────────────────────────

export function artworkSubmitted(i: { title: string }, c: Ctx): Content {
  return {
    subject: `${q(short(i.title))} is in review`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "Your artwork is in review",
      paragraphs: [`${q(i.title)} has been submitted. Our team reviews every piece before it goes live, and you'll get an email as soon as it's listed.`],
      cta: { label: "View my artworks", url: `${c.site}/dashboard/artworks` },
    },
  };
}

export function artworkSubmittedAdmin(i: { title: string; artistName: string }, c: Ctx): Content {
  return {
    subject: `Review: ${q(short(i.title))} by ${i.artistName}`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "New artwork awaiting approval",
      paragraphs: [rich`${strong(i.artistName)} submitted ${q(i.title)}.`],
      cta: { label: "Open the review queue", url: `${c.site}/admin/moderation/artworks` },
    },
  };
}

export function artworkApproved(i: { title: string; artworkId: string; certificateNumber: string | null }, c: Ctx): Content {
  return {
    subject: `${q(short(i.title))} is now live`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "Your artwork is live on the marketplace",
      paragraphs: [`${q(i.title)} has been approved and is now listed.`],
      ...(i.certificateNumber ? { details: [["Certificate of Authenticity", i.certificateNumber] as [string, string]] } : {}),
      cta: { label: "See the listing", url: `${c.site}/marketplace/${i.artworkId}` },
    },
  };
}

export function artworkRejected(i: { title: string; artworkId: string; reason: string }, c: Ctx): Content {
  return {
    subject: `${q(short(i.title))} needs changes`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "Your artwork was returned",
      paragraphs: [`${q(i.title)} wasn't approved this time. The reviewer's note is below. You can edit the piece and submit it again.`],
      note: { label: "Reviewer's note", text: i.reason },
      cta: { label: "Edit the artwork", url: `${c.site}/dashboard/artworks/${i.artworkId}/edit` },
    },
  };
}

/** An admin pulling a live piece off the marketplace used to be entirely silent. */
export function artworkDelisted(i: { title: string; reason?: string | undefined }, c: Ctx): Content {
  return {
    subject: `${q(short(i.title))} has been delisted`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "Your artwork was removed from the marketplace",
      paragraphs: [`${q(i.title)} is no longer visible to buyers. It stays in your dashboard, and nothing about your certificate or provenance record changes.`],
      ...(i.reason ? { note: { label: "Reason given", text: i.reason } } : {}),
      cta: { label: "Open my artworks", url: `${c.site}/dashboard/artworks` },
    },
  };
}

/** A tag that was linked but never locked. 48 hours and 7 days after linking, or when an admin chases it by hand. */
export function nfcLockReminder(i: { title: string; stage: "48h" | "7d" | "nudge"; linked: boolean }, c: Ctx): Content {
  const cta = { label: "See my pieces", url: `${c.site}/dashboard/coa-nfc` };
  if (i.stage === "nudge") {
    return {
      subject: `GalleryZone is waiting on the NFC tag for ${q(short(i.title))}`,
      category: "reminder",
      layout: {
        audience: "artist",
        heading: "We're waiting on your NFC tag",
        paragraphs: [`${q(i.title)} can't be dispatched until its NFC tag is ${i.linked ? "locked" : "linked and locked"}.`, "Open the GalleryZone app, choose the piece and tap the chip. If the chip failed or you need a fresh one, reply to this email."],
        cta,
      },
    };
  }
  const week = i.stage === "7d";
  return {
    subject: `Lock the NFC tag on ${q(short(i.title))}`,
    category: "reminder",
    layout: {
      audience: "artist",
      preheader: "A linked tag that isn't locked can be rewritten, and the piece can't ship until it is.",
      heading: week ? "Your tag is still not locked" : "One step left on your NFC tag",
      paragraphs: [
        `The NFC tag on ${q(i.title)} was linked ${week ? "a week ago" : "two days ago"} but has not been locked. Until it is, anyone with a phone could rewrite the chip to point somewhere else.`,
        "Locking makes the chip read-only for good, and a piece can't be dispatched to a buyer or a gallery until it's done. Open the GalleryZone app, choose the piece and tap the chip once more.",
      ],
      cta,
      footnote: "Locking is permanent. If the chip failed or you need a fresh one, contact support before locking.",
    },
  };
}

export function physicalCoaRequested(i: { title: string; requestedByName: string }, c: Ctx): Content {
  return {
    subject: `Physical certificate requested for ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "A collector wants the printed certificate",
      paragraphs: [`${i.requestedByName} has requested the physical Certificate of Authenticity for ${q(i.title)}. Print it from your dashboard, sign it, and mark it dispatched with the courier reference.`],
      cta: { label: "Open certificate requests", url: `${c.site}/dashboard/coa-nfc` },
    },
  };
}

/** The other half of the request: the person who asked now hears it is on its way. */
export function physicalCoaDispatched(i: { title: string; courierRef: string | null; role: string }, c: Ctx): Content {
  return {
    subject: `Your certificate for ${q(short(i.title))} is on its way`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: "Your printed certificate is on its way",
      paragraphs: [`The artist has signed and sent the physical Certificate of Authenticity for ${q(i.title)}.`],
      ...(i.courierRef ? { details: [["Courier reference", i.courierRef] as [string, string]] } : {}),
      cta: { label: "See my collection", url: `${c.site}${collectionPath(i.role)}` },
    },
  };
}

export function blogDecided(i: { title: string; approved: boolean; note: string | null; slug: string }, c: Ctx): Content {
  return {
    subject: i.approved ? `Your post ${q(short(i.title))} is published` : `Your post ${q(short(i.title))} needs changes`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: i.approved ? "Your blog post is published" : "Your blog post was returned",
      paragraphs: [i.approved ? `${q(i.title)} has been approved and is now live on the GalleryZone blog.` : `${q(i.title)} wasn't approved this time. You can edit it and submit it again.`],
      ...(!i.approved && i.note ? { note: { label: "Reviewer's note", text: i.note } } : {}),
      cta: i.approved ? { label: "Read it", url: `${c.site}/blogs/${i.slug}` } : { label: "Open my posts", url: `${c.site}/dashboard/blogs` },
    },
  };
}

export function externalSaleFeeDecided(i: { title: string; amountPaise: number; waived: boolean; note?: string | undefined }, c: Ctx): Content {
  return {
    subject: i.waived ? `Fee waived: ${q(short(i.title))}` : `External-sale fee confirmed: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: i.waived ? "We've waived this fee" : "Your external-sale fee is confirmed",
      paragraphs: [i.waived ? rich`The ${strong(inr(i.amountPaise))} fee on ${q(i.title)} has been waived. Nothing is owed.` : rich`The fee for selling ${q(i.title)} away from GalleryZone is ${strong(inr(i.amountPaise))}. It comes off your next settlement.`],
      ...(i.note ? { note: { label: "Note from the reviewer", text: i.note } } : {}),
      cta: { label: "View my wallet", url: `${c.site}/dashboard/wallet` },
    },
  };
}

// ── Orders (collectors, and the artist who sold) ────────────────────────

export function orderPaidBuyer(i: { orderId: string; title: string; totalPaise: number }, c: Ctx): Content {
  return {
    subject: `Order confirmed: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "collector",
      preheader: `We've received ${inr(i.totalPaise)}.`,
      heading: "Thank you, your order is confirmed",
      paragraphs: ["We've received your payment. Ownership has been recorded in the artwork's provenance passport under your name, and we'll email you when it ships."],
      details: [
        ["Artwork", i.title],
        ["Amount paid", inr(i.totalPaise)],
      ],
      cta: { label: "View my order", url: `${c.site}/account/orders/${i.orderId}` },
    },
  };
}

export function orderPaidArtist(i: { title: string; artistNetPaise: number }, c: Ctx): Content {
  return {
    subject: `Sold: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "Congratulations, your artwork sold",
      paragraphs: [rich`${q(i.title)} has been purchased. Your payout of ${strong(inr(i.artistNetPaise))} will be released to your wallet once the piece is delivered.`, "Please pack the artwork to the shipping standard in your agreement and wait for pickup instructions."],
      details: [
        ["Artwork", i.title],
        ["Your payout", inr(i.artistNetPaise)],
      ],
      cta: { label: "Open my orders", url: `${c.site}/dashboard/orders` },
    },
  };
}

interface OrderStatusInput {
  orderId: string;
  title: string;
  status: OrderStatus;
  carrier?: string | null | undefined;
  estimatedDays?: number | null | undefined;
}

/**
 * Keyed to the real OrderStatus values. "pending" and "paid" are deliberately
 * absent: the payment emails already cover that moment.
 */
export function orderStatusBuyer(i: OrderStatusInput, c: Ctx): Content | null {
  const url = `${c.site}/account/orders/${i.orderId}`;
  const cta = { label: "View my order", url };
  const audience: Audience = "collector";
  const piece = ["Artwork", i.title] as [string, string];
  switch (i.status) {
    case "confirmed":
      return { subject: `Order confirmed: ${q(short(i.title))}`, category: "transactional", layout: { audience, heading: "Your order is confirmed", paragraphs: ["We've confirmed your order with the artist. The next step is packing, and we'll email you when it's on its way."], details: [piece], cta } };
    case "packed":
      return { subject: `${q(short(i.title))} is packed and ready`, category: "transactional", layout: { audience, heading: "Packed and ready to ship", paragraphs: ["The artist has packed your piece. It hands over to the courier next, and you'll get a note the moment it moves."], details: [piece], cta } };
    case "transit": {
      const rows: Array<[string, string]> = [piece];
      if (i.carrier) rows.push(["Courier", i.carrier]);
      if (i.estimatedDays) rows.push(["Courier's estimate", `about ${i.estimatedDays} day${i.estimatedDays === 1 ? "" : "s"}`]);
      return { subject: `${q(short(i.title))} is on its way`, category: "transactional", layout: { audience, heading: "Your artwork is on its way", paragraphs: ["The piece has been handed to the courier and is on its way to you. We'll confirm once it's delivered."], details: rows, cta } };
    }
    case "delivered":
      return { subject: `${q(short(i.title))} has arrived`, category: "transactional", layout: { audience, heading: "Your artwork has arrived", paragraphs: ["It was marked delivered, and its certificate and provenance passport are in your account. Tap the NFC chip on the back of the piece with your phone to open the passport: the record that it's authentic and that it belongs to you."], details: [piece], cta: { label: "Open my order", url } } };
    case "cancelled":
      return { subject: `Order cancelled: ${q(short(i.title))}`, category: "transactional", layout: { audience, heading: "Your order was cancelled", paragraphs: ["This order has been cancelled. If you were charged, the refund is on its way to the original payment method."], details: [piece], cta } };
    default:
      return null;
  }
}

/** Only the stages that are the artist's to act on, or to know about. */
export function orderStatusArtist(i: OrderStatusInput, c: Ctx): Content | null {
  const audience: Audience = "artist";
  const cta = { label: "Open my orders", url: `${c.site}/dashboard/orders` };
  const piece = ["Artwork", i.title] as [string, string];
  switch (i.status) {
    case "confirmed":
      return { subject: `Order confirmed: ${q(short(i.title))}, your sale`, category: "transactional", layout: { audience, heading: "Your order is confirmed", paragraphs: ["Please pack the piece to the standard in your agreement and mark it packed in your dashboard."], details: [piece], cta } };
    case "transit":
      return { subject: `${q(short(i.title))} is on its way, your sale`, category: "transactional", layout: { audience, heading: "Your artwork is in transit", paragraphs: ["The piece you sold is in transit to its new owner."], details: [piece], cta } };
    case "delivered":
      return { subject: `${q(short(i.title))} was delivered, your sale`, category: "transactional", layout: { audience, heading: "Delivered", paragraphs: ["The piece has been delivered. Your settlement is released to your wallet after the return window closes."], details: [piece], cta } };
    case "cancelled":
      return { subject: `Order cancelled: ${q(short(i.title))}, your sale`, category: "transactional", layout: { audience, heading: "Your order was cancelled", paragraphs: ["This order was cancelled, so the piece returns to the marketplace."], details: [piece], cta } };
    default:
      return null;
  }
}

/** The buyer got as far as the gateway and it didn't go through. Nothing was said, so the cart just died. */
export function paymentFailed(i: { orderId: string; title: string; totalPaise: number }, c: Ctx): Content {
  return {
    subject: `Your payment for ${q(short(i.title))} didn't go through`,
    category: "transactional",
    layout: {
      audience: "collector",
      heading: "That payment didn't go through",
      paragraphs: [rich`Your payment of ${strong(inr(i.totalPaise))} for ${q(i.title)} was not completed, so the order hasn't been placed and you haven't been charged.`, "The piece is still available. It's an original, so it stays available only until someone else buys it."],
      cta: { label: "Try again", url: `${c.site}/account/orders/${i.orderId}` },
    },
  };
}

/** Opt-out reminder. One per cart entry; nothing fires it yet (it needs a scheduled job and an owner's go-ahead). */
export function abandonedCart(i: { title: string; extraCount: number }, c: Ctx): Content {
  const extra = i.extraCount > 0 ? ` and ${i.extraCount} other piece${i.extraCount > 1 ? "s" : ""}` : "";
  return {
    subject: `Still thinking about ${q(short(i.title))}?`,
    category: "reminder",
    layout: {
      audience: "collector",
      heading: "Your cart is waiting",
      paragraphs: [`You added ${q(i.title)}${extra} to your cart but didn't check out.`, "Each piece on GalleryZone is an original: once someone else buys it, it's gone. Pick up where you left off whenever you're ready."],
      cta: { label: "Return to my cart", url: `${c.site}/cart` },
      reason: "You're getting this reminder because you have items in your cart. You can turn cart reminders off in your account settings.",
    },
  };
}

// ── Ownership transfers ─────────────────────────────────────────────────

export function transferInvite(
  i: { transferId: string; toName: string; fromName: string; title: string; kind: string; givingPricePaise: number | null },
  c: Ctx,
): Content {
  const ownership = i.kind === "ownership";
  const priced = ownership && (i.givingPricePaise ?? 0) > 0;
  const what = ownership ? "transfer ownership of" : "lend for display";
  const priceLine = priced
    ? rich`${strong(i.fromName)} is transferring it to you for ${strong(inr(i.givingPricePaise!))}. If you confirm, ${i.fromName} pays the GalleryZone platform fee (5% of that price, with GST) and ownership passes to you.`
    : null;
  return {
    subject: `${i.fromName} wants to ${what} ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "anyone",
      heading: `A ${ownership ? "transfer" : "display loan"} is waiting for you`,
      paragraphs: [
        rich`${strong(i.fromName)} wants to ${what} ${q(i.title)} to you (${i.toName}).`,
        ...(priceLine ? [priceLine] : []),
        "Sign in with this email address to accept or decline. Once accepted, the artwork's provenance passport records the change.",
      ],
      cta: { label: "Review the transfer", url: `${c.site}/transfer/${i.transferId}` },
      reason: `You're getting this because ${i.fromName} entered this email address on GalleryZone.`,
    },
  };
}

/**
 * The recipient confirmed; the SENDER now owes the 5% fee before title
 * passes. The email names what they pay and sends them to the pay screen.
 */
export function transferFeeDue(
  i: { transferId: string; title: string; toName: string; givingPricePaise: number; feeTotalPaise: number; role: string },
  c: Ctx,
): Content {
  return {
    subject: `${i.toName} accepted ${q(short(i.title))} — pay the transfer fee to finish`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: "One step left — pay the transfer fee",
      paragraphs: [
        rich`${strong(i.toName)} confirmed the transfer of ${q(i.title)} at ${strong(inr(i.givingPricePaise))}.`,
        rich`Ownership passes once you pay the GalleryZone platform fee of ${strong(inr(i.feeTotalPaise))} (5% of the giving price plus 18% GST — 2% goes to the artist as royalty, 3% to GalleryZone).`,
      ],
      cta: { label: "Pay the transfer fee", url: `${c.site}/account/transfers/${i.transferId}/pay` },
    },
  };
}

export function transferAccepted(i: { artworkId: string; title: string; toName: string; kind: string; role: string }, c: Ctx): Content {
  const ownership = i.kind === "ownership";
  return {
    subject: `${i.toName} accepted ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: ownership ? "Your transfer was accepted" : "Your display loan was accepted",
      paragraphs: [ownership ? rich`${strong(i.toName)} accepted the transfer of ${q(i.title)}. The artwork's provenance passport now shows the change.` : rich`${strong(i.toName)} accepted ${q(i.title)} for display. The artwork's provenance passport records where it is.`],
      cta: { label: "See the passport", url: `${c.site}/verify/${i.artworkId}` },
    },
  };
}

export function transferCancelled(i: { title: string; fromName: string; kind: string }): Content {
  const ownership = i.kind === "ownership";
  return {
    subject: `The ${ownership ? "transfer" : "display loan"} of ${q(short(i.title))} was cancelled`,
    category: "transactional",
    layout: {
      audience: "anyone",
      heading: `The ${ownership ? "transfer" : "display loan"} was cancelled`,
      paragraphs: [rich`${strong(i.fromName)} cancelled the ${ownership ? "transfer" : "display loan"} of ${q(i.title)}, so there is nothing left for you to accept.`],
      reason: `You're getting this because ${i.fromName} had invited this email address on GalleryZone.`,
    },
  };
}

/** The invitee said no, so the person who made the offer hears it. */
export function transferDeclined(i: { artworkId: string; title: string; toName: string; kind: string; role: string }, c: Ctx): Content {
  const ownership = i.kind === "ownership";
  return {
    subject: `${i.toName} declined ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: ownership ? "Your transfer was declined" : "Your display loan was declined",
      paragraphs: [rich`${strong(i.toName)} declined the ${ownership ? "transfer" : "display loan"} of ${q(i.title)}. Nothing has changed: the artwork is still yours.`],
      cta: { label: "See the passport", url: `${c.site}/verify/${i.artworkId}` },
    },
  };
}

// ── Compliance and agreements ───────────────────────────────────────────

export function complianceDecided(i: { kind: "gst" | "kyc"; approved: boolean; reason?: string | undefined; role: string }, c: Ctx): Content {
  const aggregator = i.role === "aggregator";
  const label = i.kind === "gst" ? "GSTIN" : "KYC";
  const approvedBody = i.kind === "gst" ? (aggregator ? "Your GSTIN is verified. You can now reserve artwork." : "Your GSTIN is verified. Invoices now carry it.") : "Your KYC is verified. Withdrawals from your wallet are now open.";
  const rejectedBody =
    i.kind === "gst"
      ? `We couldn't verify your GSTIN. Correct the details in your profile and resubmit${aggregator ? ". You can't reserve artwork until it is approved." : ". Selling and settlements carry on in the meantime."}`
      : "We couldn't verify your KYC documents. Withdrawals stay on hold until this is resolved. Re-upload from your profile and we'll review again.";
  return {
    subject: i.approved ? `${label} verified` : `${label} needs another look`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: i.approved ? `Your ${label} is verified` : `We couldn't verify your ${label}`,
      paragraphs: [i.approved ? approvedBody : rejectedBody],
      ...(i.reason ? { note: { label: "Reviewer's note", text: i.reason } } : {}),
      cta: { label: "Open my profile", url: `${c.site}${profilePath(i.role)}` },
    },
  };
}

export function mouSigned(i: { party: "artist" | "aggregator"; version: string; signatureName: string; signedAt: Date; name: string }, c: Ctx): Content {
  const which = i.party === "artist" ? "Artist" : "Aggregator";
  return {
    subject: `You've signed the GalleryZone ${which} MOU`,
    category: "transactional",
    layout: {
      audience: i.party,
      heading: "Your agreement is signed",
      paragraphs: [`Thank you, ${first(i.name)}. Your signature on the GalleryZone ${which} MOU is recorded against your account. You can open the signed agreement from your profile at any time.`],
      details: [
        ["Agreement", `${which} MOU`],
        ["Version", i.version],
        ["Signed by", i.signatureName],
        ["Signed on", longDate(i.signedAt)],
      ],
      cta: { label: "Open my profile", url: `${c.site}${profilePath(i.party)}` },
    },
  };
}

// ── Aggregators and their placements ────────────────────────────────────

export function holdingReservedAggregator(i: { title: string; until: Date; advancePaise: number; displayPricePaise: number }, c: Ctx): Content {
  return {
    subject: `Reserved: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "Your reservation is confirmed",
      paragraphs: [`${q(i.title)} is reserved for you until ${longDate(i.until)}. Record the sale in your dashboard the moment it sells. A cash sale has to be remitted in full, never netted against your commission.`],
      details: [
        ["Artwork", i.title],
        ["Reserved until", longDate(i.until)],
        ["Advance committed", inr(i.advancePaise)],
        ["Display price", inr(i.displayPricePaise)],
      ],
      cta: { label: "Open my holdings", url: `${c.site}/aggregator/collection` },
    },
  };
}

/** The artist's work is leaving their studio. */
export function holdingReservedArtist(i: { title: string; gallery: string; until: Date; tagLocked: boolean }, c: Ctx): Content {
  return {
    subject: `${q(short(i.title))} has been reserved by a gallery`,
    category: "transactional",
    layout: {
      audience: "artist",
      preheader: `${i.gallery} will display it until ${longDate(i.until)}.`,
      heading: "A gallery has reserved your artwork",
      paragraphs: [
        rich`${strong(i.gallery)} has reserved ${q(i.title)} for display until ${strong(longDate(i.until))}.`,
        "Pack the piece to the standard in your agreement and wait for pickup instructions. If it doesn't sell within the placement window it comes back to you and returns to the marketplace automatically.",
        ...(i.tagLocked ? [] : ["The gallery is waiting on the NFC tag: lock it in the GalleryZone app before the piece leaves you. A piece can't be dispatched with an unlocked tag."]),
      ],
      cta: { label: "See this piece", url: `${c.site}/dashboard/coa-nfc` },
    },
  };
}

/** An aggregator priced a piece far above GalleryZone's offer. Allowed, but GalleryZone is told. */
export function holdingPriceWarning(i: { title: string; aggregatorName: string; sellingPricePaise: number; offerPaise: number | null; artworkId: string }, c: Ctx): Content {
  // The offer is only known on the route that computes it in the request; the other route stores the flag, not the offer.
  const over = i.offerPaise ? Math.round((i.sellingPricePaise / i.offerPaise - 1) * 100) : null;
  return {
    subject: over === null ? `Price warning: ${q(short(i.title))} priced above the offer` : `Price warning: ${q(short(i.title))} priced ${over}% above the offer`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "A piece was priced far above your offer",
      paragraphs: [over === null || !i.offerPaise ? rich`${strong(i.aggregatorName)} reserved ${q(i.title)} at ${strong(inr(i.sellingPricePaise))} before GST, far above GalleryZone's offer.` : rich`${strong(i.aggregatorName)} reserved ${q(i.title)} at ${strong(inr(i.sellingPricePaise))} before GST, ${over}% above GalleryZone's price of ${inr(i.offerPaise)}.`, "This is allowed and the reservation went through. It is a heads-up in case you want to look at it."],
      cta: { label: "Open this artwork", url: `${c.site}/admin/artworks/${i.artworkId}` },
    },
  };
}

export function holdingExtensionRequested(i: { title: string; aggregatorName: string; until: Date; assurance: string; artworkId: string }, c: Ctx): Content {
  return {
    subject: `Extension to decide: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "An aggregator wants to keep a piece longer",
      paragraphs: [rich`${strong(i.aggregatorName)} is asking to keep ${q(i.title)} past ${strong(longDate(i.until))}.`, "If nobody answers before the window ends, the piece goes back and the advance is released."],
      note: { label: "Their assurance that it will sell", text: i.assurance },
      cta: { label: "Review the request", url: `${c.site}/admin/artworks/${i.artworkId}` },
    },
  };
}

export function holdingExtensionDecided(i: { title: string; approved: boolean; newUntil: Date | null; note: string | null }, c: Ctx): Content {
  return {
    subject: i.approved ? `You can keep ${q(short(i.title))} longer` : `Your request for ${q(short(i.title))} was not approved`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: i.approved ? "Your request was approved" : "Your request was not approved",
      paragraphs: [i.approved ? rich`You can keep ${q(i.title)} until ${strong(i.newUntil ? longDate(i.newUntil) : "the new date")}. Your advance stays held until then.` : `${q(i.title)} goes back at the end of its window, and your advance is released then.`],
      ...(i.note ? { note: { label: "GalleryZone's note", text: i.note } } : {}),
      cta: { label: "Open my inventory", url: `${c.site}/aggregator/collection` },
    },
  };
}

/** The window ended and the piece moved on. The advance is released the same day. */
export function holdingPeriodEnded(i: { title: string; advancePaise: number }, c: Ctx): Content {
  return {
    subject: `Your period has ended: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "Your display period has ended",
      paragraphs: [`Your period for ${q(i.title)} has ended and it is now available to another aggregator.`, "The advance has been released to your wallet. The delivery deposit is not refunded on an unsold piece."],
      details: [
        ["Artwork", i.title],
        ["Advance released", inr(i.advancePaise)],
      ],
      cta: { label: "See my wallet", url: `${c.site}/aggregator/wallet` },
    },
  };
}

/** The aggregator sent an unsold piece back before its window ran out. */
export function holdingReturnedAggregator(i: { title: string; advancePaise: number }, c: Ctx): Content {
  return {
    subject: `You returned ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "Your return is recorded",
      paragraphs: [`${q(i.title)} is back on the marketplace and open to other aggregators. The advance has gone back to your wallet; the delivery deposit is not refunded on an unsold piece.`],
      details: [
        ["Artwork", i.title],
        ["Advance returned", inr(i.advancePaise)],
      ],
      cta: { label: "See my wallet", url: `${c.site}/aggregator/wallet` },
    },
  };
}

export function holdingReturnedArtist(i: { title: string; gallery: string }, c: Ctx): Content {
  return {
    subject: `${q(short(i.title))} is coming back to the marketplace`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "A gallery has returned your artwork",
      paragraphs: [rich`${strong(i.gallery)} didn't sell ${q(i.title)} and has sent it back. It is listed on the marketplace again.`],
      cta: { label: "See this piece", url: `${c.site}/dashboard/coa-nfc` },
    },
  };
}

export function saleRecordedAggregator(i: { title: string; soldPricePaise: number; buyerName: string; cash: boolean; remitBy: Date | null }, c: Ctx): Content {
  const rows: Array<[string, string]> = [
    ["Artwork", i.title],
    ["Sold for", inr(i.soldPricePaise)],
    ["Buyer", i.buyerName],
    ["Payment", i.cash ? "Cash at your premises" : "Paid to GalleryZone directly"],
  ];
  if (i.cash && i.remitBy) rows.push(["Remit by", longDate(i.remitBy)]);
  return {
    subject: `Sale recorded: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "Your sale is recorded",
      paragraphs: [i.cash ? "The buyer paid you in cash, so the full amount is due to GalleryZone. Remit it from your settlements page; it is never netted against your commission." : "The buyer is paying GalleryZone directly, so there is nothing for you to remit."],
      details: rows,
      cta: i.cash ? { label: "Open my settlements", url: `${c.site}/aggregator/settlements` } : { label: "Open my sales", url: `${c.site}/aggregator/orders` },
    },
  };
}

export function saleRecordedArtist(i: { title: string; gallery: string }, c: Ctx): Content {
  return {
    subject: `Sold through ${i.gallery}: ${q(short(i.title))}`,
    category: "transactional",
    layout: {
      audience: "artist",
      heading: "Your artwork sold at a gallery",
      paragraphs: [rich`${strong(i.gallery)} has recorded a sale of ${q(i.title)}. The piece has left its display, and the sale is in your dashboard.`],
      cta: { label: "Open my orders", url: `${c.site}/dashboard/orders` },
    },
  };
}

/** "razorpay_upi" is how the gateway names it; a person reads "UPI". */
function methodLabel(method: string): string {
  const m = method.replace(/^razorpay_?/, "").replace(/_/g, " ").trim();
  const known: Record<string, string> = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI", simulated: "Test payment" };
  return known[m] ?? (m ? m.charAt(0).toUpperCase() + m.slice(1) : "Razorpay");
}

/** What an aggregator pays in is money; they get a receipt for each kind. */
export function walletTopupReceived(i: { amountPaise: number; paidAt: Date; method: string | null }, c: Ctx): Content {
  const rows: Array<[string, string]> = [
    ["Amount added", inr(i.amountPaise)],
    ["Date", longDate(i.paidAt)],
  ];
  if (i.method) rows.push(["Paid by", methodLabel(i.method)]);
  return {
    subject: `Wallet top-up received: ${inr(i.amountPaise)}`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "Money added to your wallet",
      paragraphs: [`We've received your payment and added ${inr(i.amountPaise)} to your wallet.`],
      details: rows,
      cta: { label: "See my wallet", url: `${c.site}/aggregator/wallet` },
    },
  };
}

export function remittanceReceived(i: { amountPaise: number; paidAt: Date; saleCount: number; method: string | null }, c: Ctx): Content {
  const rows: Array<[string, string]> = [
    ["Amount remitted", inr(i.amountPaise)],
    ["Sales covered", String(i.saleCount)],
    ["Date", longDate(i.paidAt)],
  ];
  if (i.method) rows.push(["Paid by", methodLabel(i.method)]);
  return {
    subject: `Remittance received: ${inr(i.amountPaise)}`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "Your remittance is received",
      paragraphs: [`We've received ${inr(i.amountPaise)} for ${i.saleCount === 1 ? "your cash sale" : `your ${i.saleCount} cash sales`}. They're marked as remitted.`],
      details: rows,
      cta: { label: "Open my settlements", url: `${c.site}/aggregator/settlements` },
    },
  };
}

/** The reservation was paid but couldn't be completed (someone else got the piece first), so the money goes back. */
export function reservationRefunded(i: { title: string | null; amountPaise: number }, c: Ctx): Content {
  const piece = i.title ? q(i.title) : "the piece";
  return {
    subject: "Your reservation payment is being refunded",
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "We couldn't complete your reservation",
      paragraphs: [`Your payment went through, but ${piece} could not be reserved for you, so we've refunded it in full. You haven't lost anything.`, "The refund goes back to the payment method you used. Banks usually take a few working days to show it."],
      details: [["Refund", inr(i.amountPaise)]],
      cta: { label: "Browse the catalogue", url: `${c.site}/aggregator/inventory` },
    },
  };
}

/** A refund that the gateway refused is a person's job: the aggregator has paid and has nothing. */
export function refundFailedAdmin(i: { intentId: string; aggregatorName: string; amountPaise: number; reason: string }, c: Ctx): Content {
  return {
    subject: `Refund failed: ${inr(i.amountPaise)} for ${i.aggregatorName}`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "A refund needs doing by hand",
      paragraphs: [rich`${strong(i.aggregatorName)} paid ${strong(inr(i.amountPaise))} for a reservation that could not be completed, and the automatic refund failed. They have paid and have nothing, so please refund it from the Razorpay dashboard.`],
      details: [["Reservation payment", i.intentId]],
      note: { label: "What the gateway said", text: i.reason },
      cta: { label: "Open settlements", url: `${c.site}/admin/settlements` },
    },
  };
}

const ISSUE_LABEL: Record<string, string> = {
  damaged_in_transit: "Damaged in transit",
  wrong_piece: "Wrong piece",
  quality_issue: "Quality issue",
  coa_nfc_problem: "Certificate or NFC problem",
  missing_accessories: "Missing accessories",
  other: "Other",
};

export function holdingReportFiledAdmin(i: { title: string; aggregatorName: string; artistName: string; issueType: string; description: string }, c: Ctx): Content {
  const issue = ISSUE_LABEL[i.issueType] ?? i.issueType;
  return {
    subject: `Holding report: ${q(short(i.title))} (${issue})`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "An aggregator reported a problem",
      paragraphs: [rich`${strong(i.aggregatorName)} reported a problem with ${q(i.title)} by ${i.artistName}.`],
      details: [["Issue", issue]],
      note: { label: "What they wrote", text: i.description },
      cta: { label: "Open holding reports", url: `${c.site}/admin/moderation/holding-reports` },
    },
  };
}

export function holdingReportResolved(i: { title: string; resolutionNote: string | null }, c: Ctx): Content {
  return {
    subject: `Your report on ${q(short(i.title))} is resolved`,
    category: "transactional",
    layout: {
      audience: "aggregator",
      heading: "We've resolved your report",
      paragraphs: [`GalleryZone has looked into the problem you reported on ${q(i.title)} and marked it resolved.`],
      ...(i.resolutionNote ? { note: { label: "What we did", text: i.resolutionNote } } : {}),
      cta: { label: "Open my inventory", url: `${c.site}/aggregator/collection` },
    },
  };
}

// ── Withdrawals ─────────────────────────────────────────────────────────

export function withdrawalRequested(i: { amountPaise: number; role: string }, c: Ctx): Content {
  return {
    subject: `Withdrawal request received: ${inr(i.amountPaise)}`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: "We've received your withdrawal request",
      paragraphs: ["Payouts are processed within 2 working days and land in the bank account on your profile."],
      details: [
        ["Amount", inr(i.amountPaise)],
        ["Goes to", "The bank account on your profile"],
      ],
      cta: { label: "View my wallet", url: `${c.site}${walletPath(i.role)}` },
    },
  };
}

export function withdrawalRequestedAdmin(i: { name: string; amountPaise: number }, c: Ctx): Content {
  return {
    subject: `Withdrawal to approve: ${inr(i.amountPaise)} for ${i.name}`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "Withdrawal awaiting approval",
      paragraphs: [rich`${strong(i.name)} requested ${strong(inr(i.amountPaise))}.`],
      cta: { label: "Open withdrawals", url: `${c.site}/admin/moderation/withdrawals` },
    },
  };
}

export function withdrawalDecided(i: { amountPaise: number; approved: boolean; role: string }, c: Ctx): Content {
  return {
    subject: i.approved ? `Payout sent: ${inr(i.amountPaise)}` : `Withdrawal not approved: ${inr(i.amountPaise)}`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: i.approved ? "Your payout has been sent" : "Your withdrawal wasn't approved",
      paragraphs: [i.approved ? "The money has been transferred to the bank account on your profile. Allow 1 to 2 working days for it to appear." : "The amount is back in your wallet. Reply to this email if you'd like to know why."],
      details: [["Amount", inr(i.amountPaise)]],
      cta: { label: "View my wallet", url: `${c.site}${walletPath(i.role)}` },
    },
  };
}

// ── Support ─────────────────────────────────────────────────────────────

export function supportAck(i: { subject: string; role: string }, c: Ctx): Content {
  const path: Record<string, string> = { artist: "/dashboard/support", aggregator: "/aggregator/support" };
  return {
    subject: `We've got your message: ${i.subject}`,
    category: "transactional",
    layout: {
      audience: audienceOf(i.role),
      heading: "Thanks, we've got it",
      paragraphs: [rich`We've received your message about ${strong(i.subject)} and someone will come back to you, usually within one working day.`, "You can reply to this email to add anything else."],
      cta: { label: "View my messages", url: `${c.site}${path[i.role] ?? "/account/support"}` },
      reason: "You're getting this because you contacted GalleryZone support.",
    },
  };
}

export function supportNewAdmin(i: { subject: string; message: string; name: string; email: string | null; role: string | null }): Content {
  return {
    subject: `Support: ${i.subject}`,
    category: "transactional",
    layout: {
      audience: "admin",
      heading: "New support ticket",
      paragraphs: [rich`${strong(i.name)}${i.email ? ` (${i.email}${i.role ? `, ${i.role}` : ""})` : ""} wrote:`],
      note: { label: i.subject, text: i.message },
      footnote: "Reply to this email to answer them directly.",
    },
    ...(i.email ? { replyTo: i.email } : {}),
  };
}

// ── The catalogue ───────────────────────────────────────────────────────
//
// One row per email a person can receive: who gets it, what sets it off, and
// how to render it with sample data. The preview script and the check walk this
// list, and it is where to look to answer "does GalleryZone email X?".

export type Who = "Everyone" | "Collector" | "Artist" | "Aggregator" | "Admin";

export interface CatalogueEntry {
  id: string;
  who: Who;
  when: string;
  make: (c: Ctx) => Content | null;
}

const D = new Date("2026-12-04T09:30:00Z");
const T = "Evening Raga, Udaipur";

export const catalogue: CatalogueEntry[] = [
  { id: "welcome", who: "Everyone", when: "Someone registers", make: (c) => welcome({ name: "Priya Sharma", role: "customer", verifyUrl: `${c.site}/verify-email?token=abc123` }, c) },
  { id: "verify-email", who: "Everyone", when: "They ask for the confirmation link again", make: (c) => verifyEmail({ role: "artist", verifyUrl: `${c.site}/verify-email?token=abc123` }) },
  { id: "password-reset", who: "Everyone", when: "They ask to reset their password", make: (c) => passwordReset({ name: "Priya Sharma", resetUrl: `${c.site}/reset-password?token=abc123` }) },
  { id: "signup-email-otp", who: "Everyone", when: "They sign up with email+password", make: () => signupEmailOtp({ code: "428103", name: "Priya Sharma" }) },
  { id: "password-reset-otp", who: "Everyone", when: "They ask to reset their password (OTP flow)", make: () => passwordResetOtp({ code: "428103", name: "Priya Sharma" }) },
  { id: "account-suspended", who: "Everyone", when: "An admin suspends the account", make: () => accountStatus({ status: "suspended", role: "artist" }) },
  { id: "account-restored", who: "Everyone", when: "An admin restores the account", make: () => accountStatus({ status: "active", role: "artist" }) },
  { id: "bank-account-changed", who: "Everyone", when: "The payout bank account is changed or removed", make: (c) => bankAccountChanged({ maskedAccount: "•••• 4821", role: "artist" }, c) },
  { id: "deactivation-requested", who: "Everyone", when: "They ask to deactivate their account", make: () => deactivationRequested({ role: "artist" }) },
  { id: "deactivation-decided", who: "Everyone", when: "An admin decides the request", make: () => deactivationDecided({ approved: false, note: "A settlement of ₹4,200 is still open.", role: "artist" }) },
  { id: "support-ack", who: "Everyone", when: "They send a support message", make: (c) => supportAck({ subject: "My payout is late", role: "artist" }, c) },

  { id: "order-paid-buyer", who: "Collector", when: "Their payment is captured", make: (c) => orderPaidBuyer({ orderId: "ord_8f3k2", title: T, totalPaise: 1_850_000 }, c) },
  { id: "order-confirmed-buyer", who: "Collector", when: "An admin confirms the order", make: (c) => orderStatusBuyer({ orderId: "ord_8f3k2", title: T, status: "confirmed" }, c) },
  { id: "order-packed-buyer", who: "Collector", when: "The artist has packed it", make: (c) => orderStatusBuyer({ orderId: "ord_8f3k2", title: T, status: "packed" }, c) },
  { id: "order-transit-buyer", who: "Collector", when: "The courier has it", make: (c) => orderStatusBuyer({ orderId: "ord_8f3k2", title: T, status: "transit", carrier: "Delhivery", estimatedDays: 4 }, c) },
  { id: "order-delivered-buyer", who: "Collector", when: "It is marked delivered", make: (c) => orderStatusBuyer({ orderId: "ord_8f3k2", title: T, status: "delivered" }, c) },
  { id: "order-cancelled-buyer", who: "Collector", when: "The order is cancelled", make: (c) => orderStatusBuyer({ orderId: "ord_8f3k2", title: T, status: "cancelled" }, c) },
  { id: "payment-failed", who: "Collector", when: "The gateway declines their payment", make: (c) => paymentFailed({ orderId: "ord_8f3k2", title: T, totalPaise: 1_850_000 }, c) },
  { id: "transfer-invite", who: "Collector", when: "Someone invites them to take or borrow a piece", make: (c) => transferInvite({ transferId: "tr_91", toName: "Priya Sharma", fromName: "Arjun Mehta", title: T, kind: "ownership", givingPricePaise: 85_000_00 }, c) },
  { id: "transfer-fee-due", who: "Collector", when: "The recipient confirmed; the sender owes the 5% transfer fee", make: (c) => transferFeeDue({ transferId: "tr_91", title: T, toName: "Priya Sharma", givingPricePaise: 85_000_00, feeTotalPaise: 5_017_00, role: "customer" }, c) },
  { id: "transfer-accepted", who: "Collector", when: "The person they invited accepts", make: (c) => transferAccepted({ artworkId: "art_44", title: T, toName: "Priya Sharma", kind: "ownership", role: "customer" }, c) },
  { id: "transfer-cancelled", who: "Collector", when: "The sender cancels an invite", make: () => transferCancelled({ title: T, fromName: "Arjun Mehta", kind: "ownership" }) },
  { id: "transfer-declined", who: "Collector", when: "The person they invited says no", make: (c) => transferDeclined({ artworkId: "art_44", title: T, toName: "Priya Sharma", kind: "ownership", role: "customer" }, c) },
  { id: "coa-dispatched", who: "Collector", when: "The artist posts the printed certificate", make: (c) => physicalCoaDispatched({ title: T, courierRef: "DL1042233", role: "customer" }, c) },
  { id: "abandoned-cart", who: "Collector", when: "A cart sits unpaid (built, nothing fires it yet)", make: (c) => abandonedCart({ title: T, extraCount: 1 }, c) },

  { id: "artwork-submitted", who: "Artist", when: "They submit an artwork", make: (c) => artworkSubmitted({ title: T }, c) },
  { id: "artwork-approved", who: "Artist", when: "An admin approves it", make: (c) => artworkApproved({ title: T, artworkId: "art_44", certificateNumber: "GZ-2026-000417" }, c) },
  { id: "artwork-rejected", who: "Artist", when: "An admin returns it", make: (c) => artworkRejected({ title: T, artworkId: "art_44", reason: "The photograph is too dark to judge the colours. Please re-shoot in daylight." }, c) },
  { id: "artwork-delisted", who: "Artist", when: "An admin removes a live piece", make: (c) => artworkDelisted({ title: T, reason: "Reported as a duplicate listing." }, c) },
  { id: "order-paid-artist", who: "Artist", when: "Their piece sells", make: (c) => orderPaidArtist({ title: T, artistNetPaise: 1_480_000 }, c) },
  { id: "order-confirmed-artist", who: "Artist", when: "The order is confirmed", make: (c) => orderStatusArtist({ orderId: "ord_8f3k2", title: T, status: "confirmed" }, c) },
  { id: "order-transit-artist", who: "Artist", when: "The courier has the piece", make: (c) => orderStatusArtist({ orderId: "ord_8f3k2", title: T, status: "transit" }, c) },
  { id: "order-delivered-artist", who: "Artist", when: "The piece is delivered", make: (c) => orderStatusArtist({ orderId: "ord_8f3k2", title: T, status: "delivered" }, c) },
  { id: "order-cancelled-artist", who: "Artist", when: "The order is cancelled", make: (c) => orderStatusArtist({ orderId: "ord_8f3k2", title: T, status: "cancelled" }, c) },
  { id: "nfc-reminder-48h", who: "Artist", when: "A linked tag is still unlocked after 48 hours", make: (c) => nfcLockReminder({ title: T, stage: "48h", linked: true }, c) },
  { id: "nfc-reminder-7d", who: "Artist", when: "…and after 7 days", make: (c) => nfcLockReminder({ title: T, stage: "7d", linked: true }, c) },
  { id: "nfc-nudge", who: "Artist", when: "An admin chases the tag by hand", make: (c) => nfcLockReminder({ title: T, stage: "nudge", linked: false }, c) },
  { id: "coa-requested", who: "Artist", when: "A collector asks for the printed certificate", make: (c) => physicalCoaRequested({ title: T, requestedByName: "Priya Sharma" }, c) },
  { id: "kyc-verified", who: "Artist", when: "An admin approves their KYC", make: (c) => complianceDecided({ kind: "kyc", approved: true, role: "artist" }, c) },
  { id: "gst-needs-another-look", who: "Artist", when: "An admin rejects their GSTIN", make: (c) => complianceDecided({ kind: "gst", approved: false, reason: "The GSTIN belongs to a different legal name.", role: "artist" }, c) },
  { id: "mou-signed-artist", who: "Artist", when: "They sign the artist agreement", make: (c) => mouSigned({ party: "artist", version: "2026-10-22", signatureName: "Meera Iyer", signedAt: D, name: "Meera Iyer" }, c) },
  { id: "blog-published", who: "Artist", when: "An admin publishes their blog post", make: (c) => blogDecided({ title: "Notes from a Phad scroll", approved: true, note: null, slug: "notes-from-a-phad-scroll" }, c) },
  { id: "blog-returned", who: "Artist", when: "An admin returns their blog post", make: (c) => blogDecided({ title: "Notes from a Phad scroll", approved: false, note: "Please add a photo credit for the second image.", slug: "x" }, c) },
  { id: "holding-reserved-artist", who: "Artist", when: "A gallery reserves their piece", make: (c) => holdingReservedArtist({ title: T, gallery: "Kala Ghar Gallery", until: D, tagLocked: false }, c) },
  { id: "holding-returned-artist", who: "Artist", when: "A gallery sends the piece back", make: (c) => holdingReturnedArtist({ title: T, gallery: "Kala Ghar Gallery" }, c) },
  { id: "sale-recorded-artist", who: "Artist", when: "A gallery sells their piece", make: (c) => saleRecordedArtist({ title: T, gallery: "Kala Ghar Gallery" }, c) },
  { id: "external-fee-decided", who: "Artist", when: "An admin decides an external-sale fee", make: (c) => externalSaleFeeDecided({ title: T, amountPaise: 240_000, waived: false }, c) },
  { id: "withdrawal-requested", who: "Artist", when: "They request a withdrawal (aggregators too)", make: (c) => withdrawalRequested({ amountPaise: 1_480_000, role: "artist" }, c) },
  { id: "withdrawal-paid", who: "Artist", when: "An admin pays it out", make: (c) => withdrawalDecided({ amountPaise: 1_480_000, approved: true, role: "artist" }, c) },
  { id: "withdrawal-declined", who: "Artist", when: "An admin declines it", make: (c) => withdrawalDecided({ amountPaise: 1_480_000, approved: false, role: "artist" }, c) },

  { id: "holding-reserved-aggregator", who: "Aggregator", when: "Their reservation completes", make: (c) => holdingReservedAggregator({ title: T, until: D, advancePaise: 370_000, displayPricePaise: 2_100_000 }, c) },
  { id: "holding-extension-decided", who: "Aggregator", when: "An admin answers an extension request", make: (c) => holdingExtensionDecided({ title: T, approved: true, newUntil: D, note: null }, c) },
  { id: "holding-period-ended", who: "Aggregator", when: "A placement window runs out", make: (c) => holdingPeriodEnded({ title: T, advancePaise: 370_000 }, c) },
  { id: "holding-returned-aggregator", who: "Aggregator", when: "They return an unsold piece", make: (c) => holdingReturnedAggregator({ title: T, advancePaise: 370_000 }, c) },
  { id: "sale-recorded-aggregator", who: "Aggregator", when: "They record a sale", make: (c) => saleRecordedAggregator({ title: T, soldPricePaise: 2_100_000, buyerName: "Rohan Kapoor", cash: true, remitBy: D }, c) },
  { id: "wallet-topup", who: "Aggregator", when: "A wallet top-up is paid", make: (c) => walletTopupReceived({ amountPaise: 5_000_000, paidAt: D, method: "razorpay_upi" }, c) },
  { id: "remittance-received", who: "Aggregator", when: "A cash remittance is paid", make: (c) => remittanceReceived({ amountPaise: 2_100_000, paidAt: D, saleCount: 1, method: "razorpay_netbanking" }, c) },
  { id: "reservation-refunded", who: "Aggregator", when: "A paid reservation can't be completed and is refunded", make: (c) => reservationRefunded({ title: T, amountPaise: 370_000 }, c) },
  { id: "holding-report-resolved", who: "Aggregator", when: "An admin resolves their problem report", make: (c) => holdingReportResolved({ title: T, resolutionNote: "We've asked the artist to send a replacement frame." }, c) },
  { id: "mou-signed-aggregator", who: "Aggregator", when: "They sign the aggregator agreement", make: (c) => mouSigned({ party: "aggregator", version: "2026-10-22", signatureName: "Kabir Anand", signedAt: D, name: "Kabir Anand" }, c) },
  { id: "gst-verified", who: "Aggregator", when: "An admin approves their GSTIN", make: (c) => complianceDecided({ kind: "gst", approved: true, role: "aggregator" }, c) },

  { id: "artwork-submitted-admin", who: "Admin", when: "An artist submits a piece", make: (c) => artworkSubmittedAdmin({ title: T, artistName: "Meera Iyer" }, c) },
  { id: "withdrawal-requested-admin", who: "Admin", when: "Someone requests a withdrawal", make: (c) => withdrawalRequestedAdmin({ name: "Meera Iyer", amountPaise: 1_480_000 }, c) },
  { id: "deactivation-requested-admin", who: "Admin", when: "Someone asks to deactivate", make: (c) => deactivationRequestedAdmin({ name: "Meera Iyer", reason: "I'm moving abroad and stopping sales." }, c) },
  { id: "support-new-admin", who: "Admin", when: "A support ticket arrives", make: () => supportNewAdmin({ subject: "My payout is late", message: "Hi, my withdrawal from Monday hasn't arrived.\nCan you check?", name: "Meera Iyer", email: "meera@example.in", role: "artist" }) },
  { id: "holding-price-warning", who: "Admin", when: "A piece is reserved far above the offer", make: (c) => holdingPriceWarning({ title: T, aggregatorName: "Kala Ghar Gallery", sellingPricePaise: 3_000_000, offerPaise: 2_100_000, artworkId: "art_44" }, c) },
  { id: "holding-extension-requested", who: "Admin", when: "An aggregator asks for more time", make: (c) => holdingExtensionRequested({ title: T, aggregatorName: "Kala Ghar Gallery", until: D, assurance: "A collector has seen it twice and is deciding this week.", artworkId: "art_44" }, c) },
  { id: "holding-report-filed", who: "Admin", when: "An aggregator reports a problem with a piece", make: (c) => holdingReportFiledAdmin({ title: T, aggregatorName: "Kala Ghar Gallery", artistName: "Meera Iyer", issueType: "damaged_in_transit", description: "The frame corner arrived cracked." }, c) },
  { id: "refund-failed-admin", who: "Admin", when: "An automatic reservation refund fails", make: (c) => refundFailedAdmin({ intentId: "ri_77", aggregatorName: "Kala Ghar Gallery", amountPaise: 370_000, reason: "BAD_REQUEST_ERROR: payment is not captured" }, c) },
];
