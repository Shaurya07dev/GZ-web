"use client";

import { motion } from "framer-motion";
import {
  Wallet,
  Clock3,
  Lock,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Info,
} from "lucide-react";
import {
  useAggregatorWallet,
  useAggregatorWalletTransactions,
} from "@/hooks/useAggregatorWallet";
import {
  useAggregatorProfile,
  useUpdateAggregatorProfileMutation,
} from "@/hooks/useAggregatorProfile";
import { GstNumberCard } from "@/components/shared/gst-number-card";
import type { WalletTransaction } from "@/features/dashboard/dashboard-data";

// Client (18 Oct 2026): there is no wallet, no top-up, no withdrawal flow.
// The aggregator pays the deposit + delivery per piece through Razorpay at
// reservation time. Commission earned on sales sits in GalleryZone's escrow
// and the admin transfers it out directly, marking each payment paid with a
// bank reference. This view is read-only: what is owed, what is still
// clearing, and where the money will land.

export function WalletOverview() {
  const { data: wallet } = useAggregatorWallet();
  const { data: transactions } = useAggregatorWalletTransactions();
  const { data: profile } = useAggregatorProfile();
  const updateProfileMutation = useUpdateAggregatorProfileMutation();

  const balance = wallet?.balance ?? 0;
  const locked = wallet?.lockedBalance ?? 0;
  const free = balance - locked;

  const summaryCards = [
    {
      key: "free",
      label: "Owed to you",
      value: free,
      hint: "Commission GalleryZone will transfer to your bank",
      icon: Wallet,
      tone: "gold" as const,
    },
    {
      key: "locked",
      label: "Held against reservations",
      value: locked,
      hint: "Advances and delivery you paid on pieces you are displaying",
      icon: Lock,
      tone: "neutral" as const,
    },
    {
      key: "pending",
      label: "Commission clearing",
      value: wallet?.pendingBalance ?? 0,
      hint: "Earned on sales, waiting for delivery to confirm",
      icon: Clock3,
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {card.label}
              </span>
              <card.icon
                className={`size-4 ${card.tone === "gold" ? "text-gold-bright" : "text-muted-foreground"}`}
                strokeWidth={1.75}
              />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-foreground">
              ₹{card.value.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
          </motion.div>
        ))}
      </div>

      <EscrowExplainerCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
        <PayoutDestinationCard />
        <TransactionsCard transactions={transactions ?? []} />
      </div>
      {profile && (
        <GstNumberCard
          value={profile.gstNumber ?? ""}
          onSave={(gstNumber) => updateProfileMutation.mutate({ gstNumber })}
          isPending={updateProfileMutation.isPending}
          isSuccess={updateProfileMutation.isSuccess}
          description="Used on your commission settlements and invoices. Also editable from your profile."
        />
      )}
    </div>
  );
}

// The old AddFundsCard asked the aggregator to top up a wallet balance, which
// in turn paid out the per-piece deposit and delivery. That whole flow is
// gone — reservations now charge Razorpay directly, piece by piece — so this
// card just states the new money flow in one place.
function EscrowExplainerCard() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold/30 bg-gold/5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
          <Wallet className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            How the money moves
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Pay the deposit and delivery for each piece at the moment you
            reserve it, through Razorpay. GalleryZone holds the full sale
            amount in escrow when the piece sells, settles the artist&rsquo;s
            share, and transfers your commission to your bank. Each transfer
            carries a bank reference you&rsquo;ll see in the list on the right.
          </p>
        </div>
      </div>
    </div>
  );
}

// Replaces the old WithdrawCard. There is nothing to request — payouts leave
// GalleryZone's escrow on a fixed cadence against the "Owed to you" figure
// above. This card is a confirmation of where that money lands.
function PayoutDestinationCard() {
  const { data: profile } = useAggregatorProfile();
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Where your commission lands
      </h2>

      {profile?.bankAccountMasked ? (
        <div className="flex items-center gap-3 rounded-md border border-border p-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
            <Building2 className="size-4 text-gold-bright" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {profile.bankAccountMasked}
            </p>
            <p className="text-xs text-muted-foreground">{profile.ifsc}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Add a bank account on your Profile so GalleryZone has somewhere to
          send your commission.
        </p>
      )}

      <div className="flex items-start gap-2.5 rounded-md border border-gold/30 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-gold-bright" />
        <p>
          GalleryZone transfers your commission after each sale clears, with a
          bank reference you&rsquo;ll see on the right. No request needed on
          your side.
        </p>
      </div>
    </div>
  );
}

function TransactionsCard({
  transactions,
}: {
  transactions: WalletTransaction[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Transaction history
      </h2>

      <div
        className={`mt-3 flex flex-col ${
          transactions.length > 5 ? "max-h-[320px] overflow-y-auto pr-1" : ""
        }`}
      >
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions yet.
          </p>
        ) : (
          transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        )}
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isCredit = tx.amount >= 0;
  const Icon = isCredit ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
            isCredit
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{tx.label}</p>
          <p className="text-xs text-muted-foreground">
            {tx.status === "pending" ? (
              <span className="text-gold-bright">Pending</span>
            ) : (
              new Date(tx.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })
            )}
          </p>
        </div>
      </div>
      <span
        className={`shrink-0 font-mono text-sm tabular-nums ${
          isCredit ? "text-emerald-400" : "text-foreground"
        }`}
      >
        {isCredit ? "+" : "−"}₹{Math.abs(tx.amount).toLocaleString("en-IN")}
      </span>
    </div>
  );
}
