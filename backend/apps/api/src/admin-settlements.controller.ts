import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { IllegalTransitionError } from "@galleryzone/domain";
import {
  Collections,
  getOrCreatePurchaseBill,
  listSettlements,
  markSettlementProcessed,
  retrySettlement,
  SettlementError,
  type Db,
  type SettlementDoc,
} from "@galleryzone/db";
import type { AppEnv } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";
import { DB, ENV } from "./db.module.ts";
import { FirestoreRateConfigStore } from "@galleryzone/db";

const markPaidSchema = z
  .object({
    /** How the money reached the artist. Defaults to NEFT. */
    paymentMode: z.enum(["NEFT", "RTGS", "UPI", "Cheque", "Wallet"]).default("NEFT"),
    /** Bank UTR or RazorpayX payout id. Admin should always have this;
     *  if genuinely missing we accept "PENDING" and the voucher can be
     *  re-stamped later via re-processing (idempotent). */
    paymentRef: z.string().trim().min(1).default("PENDING"),
  })
  .strict();
type MarkPaidBody = z.infer<typeof markPaidSchema>;

@Controller("v1/admin/settlements")
export class AdminSettlementsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  @Roles("admin")
  @Get()
  list() {
    return listSettlements(this.db);
  }

  @Roles("admin")
  @Post(":id/retry")
  retry(@Param("id") id: string) {
    return retrySettlement(this.db, id);
  }

  /**
   * Admin confirms a settlement has been paid out of band (bank transfer
   * or UPI from a different ledger). Used for artist royalty rows on
   * resale transfers; also useful for ops cleaning up stuck items.
   *
   * Side-effect: stamps the Rule 52 purchase-cum-payment bill on the
   * underlying order so the artist can download a legally compliant
   * voucher. Stamp failure does NOT unmark the settlement — the
   * voucher can be re-stamped by any subsequent mark-paid call
   * (getOrCreate is idempotent), while the money state advancing
   * matters more to the artist than whether the PDF has been issued.
   */
  @Roles("admin")
  @Post(":id/mark-paid")
  async markPaid(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(markPaidSchema)) body: MarkPaidBody,
  ) {
    try {
      await markSettlementProcessed(this.db, id);
    } catch (error) {
      if (error instanceof SettlementError)
        throw new NotFoundException({
          type: "about:blank",
          title: error.message,
          status: 404,
          code: "not_found",
        });
      if (error instanceof IllegalTransitionError)
        throw new ConflictException({
          type: "about:blank",
          title: error.message,
          status: 409,
          code: "illegal_transition",
        });
      throw error;
    }

    // Attempt purchase-bill stamp. Only applies to settlements of
    // kind="sale" — royalty rows don't have an underlying order so
    // the stamp function throws, which we log and swallow.
    const settlementSnap = await this.db
      .collection(Collections.settlements)
      .doc(id)
      .get();
    const settlement = settlementSnap.data() as SettlementDoc | undefined;
    if (settlement && settlement.orderId && (settlement.kind ?? "sale") === "sale") {
      try {
        const rateStore = new FirestoreRateConfigStore(this.db);
        const activeVersion = await rateStore.getActiveVersion(new Date());
        if (activeVersion) {
          // TDS flag: match what the sale was posted with. ArtistSale
          // rows carry a `tdsPaise`; if non-zero, TDS applied.
          const artistSaleSnap = await this.db
            .collection(Collections.artistSales)
            .where("orderId", "==", settlement.orderId)
            .limit(1)
            .get();
          const tdsApplies =
            !artistSaleSnap.empty &&
            ((artistSaleSnap.docs[0]!.data() as { tdsPaise?: number }).tdsPaise ??
              0) > 0;
          await getOrCreatePurchaseBill(this.db, {
            settlementId: id,
            payer: {
              legalName: this.env.invoiceSeller.legalName,
              addressLine1: this.env.invoiceSeller.addressLine1,
              addressLine2: this.env.invoiceSeller.addressLine2,
              city: this.env.invoiceSeller.city,
              state: this.env.invoiceSeller.state,
              pincode: this.env.invoiceSeller.pincode,
              gstin:
                this.env.invoiceSeller.gstin ?? "UNREGISTERED",
              stateCode: this.env.invoiceSeller.stateCode,
              pan: panFromGstin(this.env.invoiceSeller.gstin) ?? "UNKNOWN",
            },
            paymentMode: body.paymentMode,
            paymentRef: body.paymentRef,
            rates: activeVersion.rates,
            tdsApplies,
          });
        }
      } catch (err) {
        // Non-fatal — voucher can be re-stamped later via a repeat
        // mark-paid, which will re-process (idempotent via existing-
        // snapshot check inside getOrCreate). Log so admin can see it.
        // eslint-disable-next-line no-console
        console.warn(
          JSON.stringify({
            event: "purchase_bill.stamp_failed",
            settlementId: id,
            orderId: settlement.orderId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }

    return { status: "processed" as const };
  }
}

/** Derive the 10-char PAN from a 15-char GSTIN. GSTINs are formatted as
 *  `{2-digit-state}{PAN}{entity-digit}{Z}{checksum}` so the PAN is
 *  always positions 3-12. Returns null if the GSTIN looks malformed. */
function panFromGstin(gstin: string | null): string | null {
  if (!gstin) return null;
  const trimmed = gstin.trim().toUpperCase();
  if (trimmed.length !== 15) return null;
  return trimmed.slice(2, 12);
}
