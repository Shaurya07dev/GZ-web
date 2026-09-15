// Withdrawal requests. @galleryzone/db's requestWithdrawal/approveWithdrawal/
// rejectWithdrawal do the real work (real ledger-balance check, real
// payout postings) — verified directly in withdrawals.check.ts against
// real Postgres.

import { Body, Controller, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { Collections, requestWithdrawal, approveWithdrawal, rejectWithdrawal, FirestoreRateConfigStore, type Db, type WithdrawalRequestDoc } from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { Emails } from "./mail/emails.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const requestSchema = z.object({ amountPaise: z.number().int().positive() }).strict();
type RequestBody = z.infer<typeof requestSchema>;

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
    const result = await requestWithdrawal({ db: this.db, userId: req.authUser.uid, accountType: "artist_payable", amountPaise: body.amountPaise, rates });
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
    const result = await approveWithdrawal(this.db, id, "artist_payable");
    if (request) void this.emails.withdrawalDecided({ withdrawalId: id, userId: request.userId, amountPaise: request.amountPaise, approved: true }).catch(this.emails.swallow("withdrawal mail"));
    return result;
  }

  @Roles("admin")
  @Post(":id/reject")
  async reject(@Param("id") id: string) {
    const request = await this.withdrawalOf(id);
    await rejectWithdrawal(this.db, id);
    if (request) void this.emails.withdrawalDecided({ withdrawalId: id, userId: request.userId, amountPaise: request.amountPaise, approved: false }).catch(this.emails.swallow("withdrawal mail"));
    return { status: "rejected" };
  }

  private async withdrawalOf(id: string): Promise<WithdrawalRequestDoc | null> {
    const snap = await this.db.collection(Collections.withdrawalRequests).doc(id).get();
    return (snap.data() as WithdrawalRequestDoc | undefined) ?? null;
  }
}
