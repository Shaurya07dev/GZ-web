// Reminds buyers about carts they built and never paid.
//
// A hourly in-process timer, same pattern as NfcReminderSweep and
// HoldingExpirySweep — nothing extra to deploy, Railway's one Node process
// runs it. Turn it off with ABANDONED_CART_SWEEP=false.
//
// Rules of the mail:
//   * Fires once per cart's "first-entry added-at timestamp" — if the buyer
//     adds something else, the first-entry key changes and a new mail is
//     eligible for the new oldest entry. If they remove the first entry,
//     same: reminder for the next-oldest.
//   * Only fires for carts whose oldest entry is between 24h and 7d old.
//     Fresher than 24h: give them time to come back on their own; older
//     than 7d: they've seen the mail already or made a decision, don't
//     nag indefinitely.
//   * Honours notificationPreferences.abandonedCart — the Emails helper
//     already checks it and returns silently when the user has opted out.
//
// Added 8 Nov 2026 — the email template and preference have existed since
// 31 Oct but nothing fired them.

import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { findAbandonedCarts, type Db } from "@galleryzone/db";
import { DB } from "./db.module.ts";
import { Emails } from "./mail/emails.ts";

const EVERY_MS = 60 * 60_000;
const AGE_HOURS = 24;
const MAX_AGE_HOURS = 24 * 7;
const BATCH_LIMIT = 100;

@Injectable()
export class AbandonedCartSweep implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AbandonedCartSweep.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.ABANDONED_CART_SWEEP === "false") return;
    // Wait two minutes for app warm-up so a boot flap can't flood the queue.
    const first = setTimeout(() => void this.sweep(), 2 * 60_000);
    first.unref();
    this.timer = setInterval(() => void this.sweep(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await findAbandonedCarts(this.db, {
        ageHours: AGE_HOURS,
        maxAgeHours: MAX_AGE_HOURS,
        limit: BATCH_LIMIT,
      });
      for (const cart of due) {
        try {
          // The mail needs the artwork title, which `AbandonedCart` doesn't
          // carry — read it here so the cart helper stays dependency-free.
          const artwork = await this.db.collection("artworks").doc(cart.firstEntry.artworkId).get();
          const title = (artwork.data() as { title?: string } | undefined)?.title ?? "an artwork";
          await this.emails.abandonedCart({
            uid: cart.userId,
            firstArtworkTitle: title,
            extraCount: cart.extraCount,
            cartEntryKey: cart.cartEntryKey,
          });
        } catch (error) {
          this.logger.error(`abandoned-cart mail for ${cart.userId} failed: ${String(error)}`);
        }
      }
      if (due.length) this.logger.log(`queued ${due.length} abandoned-cart reminder(s)`);
    } catch (error) {
      this.logger.error(`abandoned-cart sweep failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
