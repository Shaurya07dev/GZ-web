// Withdrawal requests. @galleryzone/db's requestWithdrawal/approveWithdrawal/
// rejectWithdrawal do the real work (real ledger-balance check, real
// payout postings) — verified directly in withdrawals.check.ts against
// real Postgres.

import { Body, ConflictException, Controller, Inject, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { Collections, requestWithdrawal, approveWithdrawal, rejectWithdrawal, FirestoreRateConfigStore, WithdrawalError, type Db, type WithdrawalRequestDoc } from "@galleryzone/db";
import { IllegalTransitionError } from "@galleryzone/domain";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { Emails } from "./mail/emails.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const requestSchema = z.object({ amountPaise: z.number().int().positive() }).strict();
type RequestBody = z.infer<typeof requestSchema>;

// These errors are the two an artist actually hits — below the minimum, and
// more than the balance — and both used to fall through the filter as a 500,
// so the form showed a generic failure instead of the reason.
function rethrow(error: unknown): never {
  if (error instanceof WithdrawalError) {
    if (error.message.startsWith("No withdrawal request")) {
      throw new NotFoundException({ type: "about:blank", title: "Not found", status: 404, code: "not_found" });
    }
    throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "withdrawal_rejected" });
  }
  if (error instanceof IllegalTransitionError) {
    throw new ConflictException({ type: "about:blank", title: error.message, status: 409, code: "illegal_transition" });
  }
  throw error;
}

@Controller("v1/artist/withdrawals")
export class WithdrawalsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

  @Roles("artist")
  @Post()
  async request(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(requestSchema)) body: RequestBody) {
    const rates = await loadActiveRates(new FirestoreRateConfigStore(this.db));
    let result: { withdrawalId: string };
    try {
      result = await requestWithdrawal({ db: this.db, userId: req.authUser.uid, accountType: "artist_payable", amountPaise: body.amountPaise, rates });
    } catch (error) {
      rethrow(error);
    }
    void this.emails.withdrawalRequested({ withdrawalId: result.withdrawalId, userId: req.authUser.uid, amountPaise: body.amountPaise }).catch(this.emails.swallow("withdrawal mail"));
    return result;
  }
}

@Controller("v1/admin/withdrawals")
export class AdminWithdrawalsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

  @Roles("admin")
  @Post(":id/approve")
  async approve(@Param("id") id: string) {
    // Only artists can request withdrawals today (aggregators are agents,
    // customers' wallets are store credit), so the account type is fixed.
    const request = await this.withdrawalOf(id);
    let result: { transactionId: string };
    try {
      result = await approveWithdrawal(this.db, id, "artist_payable");
    } catch (error) {
      rethrow(error);
    }
    if (request) void this.emails.withdrawalDecided({ withdrawalId: id, userId: request.userId, amountPaise: request.amountPaise, approved: true }).catch(this.emails.swallow("withdrawal mail"));
    return result;
  }

  @Roles("admin")
  @Post(":id/reject")
  async reject(@Param("id") id: string) {
    const request = await this.withdrawalOf(id);
    try {
      await rejectWithdrawal(this.db, id);
    } catch (error) {
      rethrow(error);
    }
    if (request) void this.emails.withdrawalDecided({ withdrawalId: id, userId: request.userId, amountPaise: request.amountPaise, approved: false }).catch(this.emails.swallow("withdrawal mail"));
    return { status: "rejected" };
  }

  private async withdrawalOf(id: string): Promise<WithdrawalRequestDoc | null> {
    const snap = await this.db.collection(Collections.withdrawalRequests).doc(id).get();
    return (snap.data() as WithdrawalRequestDoc | undefined) ?? null;
  }
}
