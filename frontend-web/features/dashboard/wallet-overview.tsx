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
  useArtistWallet,
  useArtistWalletTransactions,
  usePendingSettlements,
} from "@/hooks/useArtistWallet";
import { ARTIST_PAYOUT_DAYS_AFTER_DELIVERY } from "@/lib/pricing";
import type { Settlement } from "@/types/admin";
import {
  useArtistAccountProfile,
  useSaveArtistProfileMutation,
} from "@/hooks/useArtistAccount";
import { GstNumberCard } from "@/components/shared/gst-number-card";
import type { WalletTransaction } from "./dashboard-data";

// Client (18 Oct 2026): there is no wallet, no withdrawal flow. Money sits
// in GalleryZone's escrow and the admin pays artists out directly against
// the balance shown here, marking the transfer as paid with a reference
// number from the admin console. The artist's view is read-only: how much
// is owed, how much is still clearing, and where it will land.

export function WalletOverview() {
  const { data: wallet } = useArtistWallet();
  const { data: transactions } = useArtistWalletTransactions();
  // Same field the profile page edits — one GST number per artist, reachable
  // from either screen.
  const { data: profile } = useArtistAccountProfile();
  const saveProfileMutation = useSaveArtistProfileMutation();

  const summaryCards = [
    {
      key: "balance",
      label: "Owed to you",
      value: wallet?.balance ?? 0,
      icon: Wallet,
      tone: "gold" as const,
    },
    {
      key: "pending",
      label: "Clearing (awaiting delivery)",
      value: wallet?.pendingBalance ?? 0,
      icon: Clock3,
      tone: "neutral" as const,
    },
    {
      key: "locked",
      label: "On hold",
      value: wallet?.lockedBalance ?? 0,
      icon: Lock,
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
          </motion.div>
        ))}
      </div>

      <PendingSettlementsCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
        <PayoutDestinationCard />
        <TransactionsCard transactions={transactions ?? []} />
      </div>
      {profile && (
        <GstNumberCard
          value={profile.gstin ?? ""}
          onSave={(gstin) => saveProfileMutation.mutate({ gstin })}
          isPending={saveProfileMutation.isPending}
          isSuccess={saveProfileMutation.isSuccess}
          description="Used on your settlement statements and invoices. Also editable from your profile."
          required
        />
      )}
    </div>
  );
}

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

// Money from a sale is not yours to withdraw the moment it sells. It clears
// 7 days after the artwork reaches the buyer, so this card exists to answer
// "where is my money" before the artist has to ask.
function PendingSettlementsCard() {
  const { data: settlements } = usePendingSettlements();

  if (!settlements || settlements.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:p-6">
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">
          On the way to you
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Sales clear {ARTIST_PAYOUT_DAYS_AFTER_DELIVERY} days after the
          artwork is delivered to the buyer.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {settlements.map((settlement) => (
          <li
            key={settlement.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3.5 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {settlement.artworkTitle}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {settlementStage(settlement)}
              </p>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              ₹{settlement.artistAmount.toLocaleString("en-IN")}
            </span>
          </li>
        ))}
      </ul>

    </div>
  );
}

function settlementStage(settlement: Settlement): string {
  if (settlement.releaseAfter) {
    return `Delivered — clears ${formatDay(settlement.releaseAfter)}`;
  }
  return "Waiting for the artwork to be delivered";
}

// The artist no longer requests payouts — GalleryZone's admin pays against
// the balance shown here directly and marks each payment paid with a
// reference number. This card just shows the bank account the money will
// land in, with a line of context in place of the old amount field.
function PayoutDestinationCard() {
  const { data: profile } = useArtistAccountProfile();

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Where your payouts land
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
          send your settlements.
        </p>
      )}

      <div className="flex items-start gap-2.5 rounded-md border border-gold/30 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-gold-bright" />
        <p>
          GalleryZone holds every sale in escrow and transfers what you&rsquo;re
          owed directly to this account. Each transfer is marked with a bank
          reference number you&rsquo;ll see in the transactions list below.
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
          <p className="py-6 text-center text-xs text-muted-foreground">
            No transactions yet — your settlements and payouts will appear here.
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
