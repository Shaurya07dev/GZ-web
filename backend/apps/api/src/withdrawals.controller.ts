// Withdrawal requests. @galleryzone/db's requestWithdrawal/approveWithdrawal/
// rejectWithdrawal do the real work (real ledger-balance check, real
// payout postings) — verified directly in withdrawals.check.ts against
// real Postgres.

import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { requestWithdrawal, approveWithdrawal, rejectWithdrawal, PostgresRateConfigStore, type Db } from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const requestSchema = z.object({ amountPaise: z.number().int().positive() }).strict();
type RequestBody = z.infer<typeof requestSchema>;

@Controller("v1/artist/withdrawals")
export class WithdrawalsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("artist")
  @Post()
  async request(@Body(new ZodValidationPipe(requestSchema)) body: RequestBody) {
    const rates = await loadActiveRates(new PostgresRateConfigStore(this.db));
    // TODO(Phase 1): userId from the authenticated request.
    return requestWithdrawal({ db: this.db, userId: "TODO-authenticated-user-id", accountType: "artist_payable", amountPaise: body.amountPaise, rates });
  }
}

@Controller("v1/admin/withdrawals")
export class AdminWithdrawalsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Post(":id/approve")
  approve(@Param("id") id: string) {
    // The account type an approval discharges depends on who requested it
    // (artist_payable vs aggregator_payable vs customer_wallet) — Phase 1
    // resolves this from the withdrawal_requests.user_id's role; hardcoded
    // here as a placeholder for the single-role artist flow this endpoint
    // currently serves.
    return approveWithdrawal(this.db, id, "artist_payable");
  }

  @Roles("admin")
  @Post(":id/reject")
  reject(@Param("id") id: string) {
    return rejectWithdrawal(this.db, id);
  }
}
