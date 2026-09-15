// Every product email, as a function: look up what's needed, render the
// template, hand it to the Mailer. Callers `void` these from the request
// path — a mail failure is logged, never surfaced as an API error.
//
// Templates are deliberately plain HTML (table layout, inline styles,
// system fonts): they render the same in Gmail, Outlook and Apple Mail,
// and there is nothing to build. Money arrives in paise and is formatted
// here.

import { Inject, Injectable, Logger } from "@nestjs/common";
import { Collections, type Db, type UserDoc } from "@galleryzone/db";
import type { AppEnv } from "@galleryzone/config";
import { DB, ENV } from "../db.module.ts";
import { Mailer } from "./mailer.ts";

const BRAND = "GalleryZone";
const GOLD = "#b8892b";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

interface Layout {
  preheader?: string;
  heading: string;
  /** Paragraphs, already escaped where user data is involved. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

function render(site: string, l: Layout): { html: string; text: string } {
  const paragraphs = l.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#2a2521;">${p}</p>`).join("");
  const cta = l.cta
    ? `<p style="margin:22px 0;"><a href="${l.cta.url}" style="display:inline-block;background:${GOLD};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">${esc(l.cta.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;color:#6b635c;">If the button doesn't work, copy this link: <a href="${l.cta.url}" style="color:${GOLD};">${l.cta.url}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f1ea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
${l.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(l.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e8e0d4;">
<tr><td style="padding:28px 32px 8px;"><a href="${site}" style="font-size:20px;font-weight:700;letter-spacing:.02em;color:#1a1410;text-decoration:none;">${BRAND}</a></td></tr>
<tr><td style="padding:8px 32px 0;"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1a1410;">${esc(l.heading)}</h1>${paragraphs}${cta}
${l.footnote ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#6b635c;">${l.footnote}</p>` : ""}</td></tr>
<tr><td style="padding:24px 32px 28px;font-size:12px;color:#8a817a;border-top:1px solid #efe8de;margin-top:16px;">Every piece on ${BRAND} carries a verifiable identity — who made it, who owns it, and where it has been.<br><a href="${site}" style="color:#8a817a;">${site.replace(/^https?:\/\//, "")}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [l.heading, "", ...l.paragraphs.map((p) => p.replace(/<[^>]+>/g, "")), l.cta ? `\n${l.cta.label}: ${l.cta.url}` : "", l.footnote ? `\n${l.footnote.replace(/<[^>]+>/g, "")}` : ""].join("\n");
  return { html, text };
}

/** Pulls the oobCode out of a Firebase action link so the email can point at OUR page, not Firebase's handler. */
export function oobCodeOf(actionLink: string): string | null {
  try {
    return new URL(actionLink).searchParams.get("oobCode");
  } catch {
    return null;
  }
}

@Injectable()
export class Emails {
  private readonly logger = new Logger(Emails.name);
  private readonly site: string;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) env: AppEnv,
    private readonly mailer: Mailer,
  ) {
    this.site = (process.env.PUBLIC_SITE_URL || env.corsOrigins[0] || "https://www.galleryzone.art").replace(/\/$/, "");
  }

  private async user(uid: string): Promise<(UserDoc & { uid: string }) | null> {
    const snap = await this.db.collection(Collections.users).doc(uid).get();
    const doc = snap.data() as UserDoc | undefined;
    return doc ? { uid, ...doc } : null;
  }

  private async admins(): Promise<string[]> {
    const snap = await this.db.collection(Collections.users).where("role", "==", "admin").get();
    return snap.docs.map((d) => (d.data() as UserDoc).email).filter(Boolean);
  }

  private async deliver(key: string, to: string | string[], subject: string, layout: Layout, replyTo?: string) {
    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
    if (!recipients.length) return;
    const { html, text } = render(this.site, layout);
    await this.mailer.send({ to: recipients, subject, html, text, idempotencyKey: key, replyTo });
  }

  // ── Account ──────────────────────────────────────────────────────────

  async welcome(uid: string, verifyUrl: string | null) {
    const u = await this.user(uid);
    if (!u) return;
    const roleLine = { artist: "You can now list your work, sign the artist agreement and start selling.", aggregator: "You can now browse the catalogue and reserve pieces for display.", customer: "You can now collect original artworks with a verifiable provenance record.", admin: "" }[u.role];
    await this.deliver(`welcome/${uid}`, u.email, `Welcome to ${BRAND}, ${u.name.split(" ")[0]}`, {
      preheader: verifyUrl ? "Confirm your email to finish setting up." : "Your account is ready.",
      heading: `Welcome, ${esc(u.name)}`,
      paragraphs: [`Your ${BRAND} account is ready. ${roleLine}`, ...(verifyUrl ? ["Please confirm your email address so we can reach you about orders and your account."] : [])],
      ...(verifyUrl ? { cta: { label: "Confirm my email", url: verifyUrl } } : { cta: { label: `Open ${BRAND}`, url: this.site } }),
    });
  }

  async passwordReset(email: string, name: string | null, resetUrl: string) {
    await this.deliver(`password-reset/${email}/${Date.now().toString(36)}`, email, `Reset your ${BRAND} password`, {
      preheader: "This link works once and expires in an hour.",
      heading: "Reset your password",
      paragraphs: [`Hi${name ? ` ${esc(name.split(" ")[0]!)}` : ""}, someone asked to reset the password for this account. If that was you, choose a new one below.`, "If you didn't ask for this, you can ignore this email — your password stays the same."],
      cta: { label: "Choose a new password", url: resetUrl },
      footnote: "The link works once and expires after one hour.",
    });
  }

  // ── Artworks ─────────────────────────────────────────────────────────

  async artworkSubmitted(artworkId: string, artistId: string, title: string) {
    const [artist, admins] = await Promise.all([this.user(artistId), this.admins()]);
    if (artist) {
      await this.deliver(`artwork-submitted/${artworkId}`, artist.email, `“${title}” is in review`, {
        heading: "Your artwork is in review",
        paragraphs: [`“${esc(title)}” has been submitted. Our team reviews every piece before it goes live; you'll get an email as soon as it's listed.`],
        cta: { label: "View my artworks", url: `${this.site}/dashboard/artworks` },
      });
    }
    await this.deliver(`artwork-submitted-admin/${artworkId}`, admins, `Review: “${title}” by ${artist?.name ?? "an artist"}`, {
      heading: "New artwork awaiting approval",
      paragraphs: [`<strong>${esc(artist?.name ?? "An artist")}</strong> submitted “${esc(title)}”.`],
      cta: { label: "Open moderation queue", url: `${this.site}/admin/artworks` },
    });
  }

  async artworkApproved(artworkId: string, artistId: string, title: string, certificateNumber: string | null) {
    const artist = await this.user(artistId);
    if (!artist) return;
    await this.deliver(`artwork-approved/${artworkId}`, artist.email, `“${title}” is now live`, {
      heading: "Your artwork is live on the marketplace",
      paragraphs: [`“${esc(title)}” has been approved and is now listed.`, ...(certificateNumber ? [`Certificate of Authenticity <strong>${esc(certificateNumber)}</strong> has been issued for it.`] : [])],
      cta: { label: "See the listing", url: `${this.site}/marketplace/${artworkId}` },
    });
  }

  async artworkRejected(artworkId: string, artistId: string, title: string, reason: string) {
    const artist = await this.user(artistId);
    if (!artist) return;
    await this.deliver(`artwork-rejected/${artworkId}/${Date.now().toString(36)}`, artist.email, `“${title}” needs changes`, {
      heading: "Your artwork was returned",
      paragraphs: [`“${esc(title)}” wasn't approved this time. The reviewer's note:`, `<em>${esc(reason)}</em>`, "You can edit the piece and submit it again."],
      cta: { label: "Edit the artwork", url: `${this.site}/dashboard/artworks/${artworkId}/edit` },
    });
  }

  // ── Orders ───────────────────────────────────────────────────────────

  async orderPaid(input: { orderId: string; customerId: string; artistId: string; title: string; totalPaise: number; artistNetPaise: number }) {
    const [buyer, artist] = await Promise.all([this.user(input.customerId), this.user(input.artistId)]);
    if (buyer) {
      await this.deliver(`order-paid-buyer/${input.orderId}`, buyer.email, `Order confirmed — “${input.title}”`, {
        preheader: `We've received ${inr(input.totalPaise)}.`,
        heading: "Thank you — your order is confirmed",
        paragraphs: [`We've received your payment of <strong>${inr(input.totalPaise)}</strong> for “${esc(input.title)}”.`, "Ownership has been recorded in the artwork's provenance passport under your name. We'll email you when it ships."],
        cta: { label: "View my order", url: `${this.site}/account/orders/${input.orderId}` },
      });
    }
    if (artist) {
      await this.deliver(`order-paid-artist/${input.orderId}`, artist.email, `Sold: “${input.title}”`, {
        heading: "Congratulations — your artwork sold",
        paragraphs: [`“${esc(input.title)}” has been purchased. Your payout of <strong>${inr(input.artistNetPaise)}</strong> will be released to your wallet once the piece is delivered.`, "Please pack the artwork to the shipping standard in your agreement and wait for pickup instructions."],
        cta: { label: "Open my dashboard", url: `${this.site}/dashboard/orders` },
      });
    }
  }

  async orderStatus(input: { orderId: string; customerId: string; title: string; status: string }) {
    const buyer = await this.user(input.customerId);
    if (!buyer) return;
    const copy: Record<string, { subject: string; heading: string; body: string }> = {
      shipped: { subject: `“${input.title}” has shipped`, heading: "Your artwork is on its way", body: "The piece has been dispatched. We'll let you know when it's delivered." },
      delivered: { subject: `“${input.title}” was delivered`, heading: "Delivered", body: "Your artwork has been delivered. Its certificate and provenance passport are in your account." },
      cancelled: { subject: `Order cancelled — “${input.title}”`, heading: "Your order was cancelled", body: "This order has been cancelled. If you were charged, the refund is on its way to the original payment method." },
      refunded: { subject: `Refund issued — “${input.title}”`, heading: "Refund issued", body: "Your refund has been issued to the original payment method. It can take 5–7 working days to appear." },
    };
    const c = copy[input.status];
    if (!c) return;
    await this.deliver(`order-${input.status}/${input.orderId}`, buyer.email, c.subject, {
      heading: c.heading,
      paragraphs: [c.body],
      cta: { label: "View my order", url: `${this.site}/account/orders/${input.orderId}` },
    });
  }

  // ── Ownership / CoA ──────────────────────────────────────────────────

  async transferInvite(input: { transferId: string; toEmail: string; toName: string; fromName: string; title: string; kind: string }) {
    const what = input.kind === "ownership" ? "transfer ownership of" : "lend for display";
    await this.deliver(`transfer-invite/${input.transferId}`, input.toEmail, `${input.fromName} wants to ${what} “${input.title}”`, {
      heading: `A ${input.kind === "ownership" ? "transfer" : "display loan"} is waiting for you`,
      paragraphs: [`<strong>${esc(input.fromName)}</strong> wants to ${what} “${esc(input.title)}” to you (${esc(input.toName)}).`, `Sign in with this email address to accept or decline. Once accepted, the artwork's provenance passport records the change.`],
      cta: { label: "Review the transfer", url: `${this.site}/transfer/${input.transferId}` },
    });
  }

  async physicalCoaRequested(input: { requestId: string; artistId: string; title: string; requestedByName: string }) {
    const artist = await this.user(input.artistId);
    if (!artist) return;
    await this.deliver(`coa-request/${input.requestId}`, artist.email, `Physical certificate requested for “${input.title}”`, {
      heading: "A collector wants the printed certificate",
      paragraphs: [`${esc(input.requestedByName)} has requested the physical Certificate of Authenticity for “${esc(input.title)}”. Print it from your dashboard, sign it, and mark it dispatched with the courier reference.`],
      cta: { label: "Open certificate requests", url: `${this.site}/dashboard/coa` },
    });
  }

  // ── Money ────────────────────────────────────────────────────────────

  async withdrawalRequested(input: { withdrawalId: string; userId: string; amountPaise: number }) {
    const [user, admins] = await Promise.all([this.user(input.userId), this.admins()]);
    if (user) {
      await this.deliver(`withdrawal-requested/${input.withdrawalId}`, user.email, `Withdrawal request received — ${inr(input.amountPaise)}`, {
        heading: "We've received your withdrawal request",
        paragraphs: [`<strong>${inr(input.amountPaise)}</strong> is on its way to review. Payouts are processed within 2 working days and land in the bank account on your profile.`],
        cta: { label: "View my wallet", url: `${this.site}/dashboard/wallet` },
      });
    }
    await this.deliver(`withdrawal-requested-admin/${input.withdrawalId}`, admins, `Withdrawal to approve: ${inr(input.amountPaise)} for ${user?.name ?? input.userId}`, {
      heading: "Withdrawal awaiting approval",
      paragraphs: [`<strong>${esc(user?.name ?? input.userId)}</strong> requested <strong>${inr(input.amountPaise)}</strong>.`],
      cta: { label: "Open withdrawals", url: `${this.site}/admin/withdrawals` },
    });
  }

  async withdrawalDecided(input: { withdrawalId: string; userId: string; amountPaise: number; approved: boolean }) {
    const user = await this.user(input.userId);
    if (!user) return;
    await this.deliver(`withdrawal-${input.approved ? "approved" : "rejected"}/${input.withdrawalId}`, user.email, input.approved ? `Payout sent — ${inr(input.amountPaise)}` : `Withdrawal not approved — ${inr(input.amountPaise)}`, {
      heading: input.approved ? "Your payout has been sent" : "Your withdrawal wasn't approved",
      paragraphs: [
        input.approved
          ? `<strong>${inr(input.amountPaise)}</strong> has been transferred to the bank account on your profile. Allow 1–2 working days for it to appear.`
          : `Your request for <strong>${inr(input.amountPaise)}</strong> was not approved. The amount is back in your wallet. Reply to this email if you'd like to know why.`,
      ],
      cta: { label: "View my wallet", url: `${this.site}/dashboard/wallet` },
    });
  }

  /** Any unexpected failure in a mail hook is logged here — never propagated. */
  swallow(label: string) {
    return (error: unknown) => this.logger.error(`${label}: ${String(error)}`);
  }
}
