import type { BuyerInvite } from "@/types/customer";

// Walk-in buyers of partner-gallery sales are recorded on the sale itself
// (aggregator sale → buyerEmail). Attaching that purchase to an account
// created later needs a signed invite on the API — not built yet — so
// nothing is claimed here and nothing is faked.
export const buyerInviteService = {
  listPendingFor: (_email: string): BuyerInvite[] => [],
  listClaimed: async (): Promise<BuyerInvite[]> => [],
  claimForEmail: (_input: { email: string; name: string }): BuyerInvite[] => [],
};
