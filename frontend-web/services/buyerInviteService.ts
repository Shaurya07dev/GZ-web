import type { BuyerInvite } from "@/types/customer";
import { mockDelay } from "@/lib/mock-utils";
import { buyerInvitesCol, customerProfileCol } from "@/lib/mock-collections";

// Connects a walk-in buyer to a GalleryZone account.
//
// An aggregator sells a piece in person and types the buyer's name and email.
// That buyer has no account, so the artwork would otherwise vanish from their
// side of the platform entirely. This keeps an unclaimed record against the
// email; when someone registers with that address, the piece lands in their
// collection with its certificate and ownership record already attached.
//
// Email is the join key. With a real backend this becomes an invite email with
// a signed token; the shape of the flow doesn't change.

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export const buyerInviteService = {
  // Called when an aggregator records a sale.
  create: (input: Omit<BuyerInvite, "id" | "claimedAt">): BuyerInvite => {
    const invite: BuyerInvite = {
      ...input,
      email: normalize(input.email),
      id: `inv-${crypto.randomUUID().slice(0, 8)}`,
      claimedAt: null,
    };
    buyerInvitesCol.set([invite, ...buyerInvitesCol.get()]);
    return invite;
  },

  listPendingFor: (email: string): BuyerInvite[] =>
    buyerInvitesCol
      .get()
      .filter(
        (invite) =>
          invite.claimedAt === null && invite.email === normalize(email),
      ),

  // Everything already claimed by the signed-in collector — what their
  // collection should include on top of their own delivered orders.
  listClaimed: (): Promise<BuyerInvite[]> => {
    const email = normalize(customerProfileCol.get().email);
    return mockDelay(
      buyerInvitesCol
        .get()
        .filter(
          (invite) => invite.claimedAt !== null && invite.email === email,
        ),
    );
  },

  // Run at registration. Claims every pending purchase for that address and
  // points the demo collector profile at it, so the new account is the one
  // that owns them.
  claimForEmail: (input: { email: string; name: string }): BuyerInvite[] => {
    const email = normalize(input.email);
    const pending = buyerInvitesCol
      .get()
      .filter((invite) => invite.claimedAt === null && invite.email === email);
    if (pending.length === 0) return [];

    const now = new Date().toISOString();
    const claimedIds = new Set(pending.map((invite) => invite.id));
    buyerInvitesCol.set(
      buyerInvitesCol
        .get()
        .map((invite) =>
          claimedIds.has(invite.id) ? { ...invite, claimedAt: now } : invite,
        ),
    );

    customerProfileCol.set({
      ...customerProfileCol.get(),
      name: input.name || customerProfileCol.get().name,
      email: input.email.trim(),
    });

    return pending.map((invite) => ({ ...invite, claimedAt: now }));
  },
};
