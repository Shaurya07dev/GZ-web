"use client";

import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Clock3,
  Info,
  Landmark,
  Lock,
  Wallet,
} from "lucide-react";
import {
  useAggregatorWallet,
  useAggregatorWalletTransactions,
} from "@/hooks/useAggregatorWallet";
import {
  useAggregatorCollection,
} from "@/hooks/useAggregatorCollection";
import {
  useAggregatorProfile,
  useUpdateAggregatorProfileMutation,
} from "@/hooks/useAggregatorProfile";
import { GstNumberCard } from "@/components/shared/gst-number-card";
import { formatINR } from "@/lib/utils";
import type { WalletTransaction } from "@/features/dashboard/dashboard-data";
import type { AggregatorHolding } from "@/types/aggregator";
import type { ArtworkSummary } from "@/types/artwork";

// IMPORTANT: there is NO wallet, NO top-up, NO withdrawal flow on this
// platform. Client decision 18 Oct 2026. The aggregator pays the
// advance + delivery per piece through Razorpay AT RESERVATION TIME.
// Commission earned on sales sits in GalleryZone's escrow and admin
// transfers it to the aggregator's bank with a reference number.
//
// This page is called "Earnings" in nav; its job is to explain the
// escrow state honestly: what is held against which reservation, what
// is owed to the aggregator as commission, and where that commission
// lands. No actionable "add funds" or "withdraw" button — on purpose.

type HoldingRow = AggregatorHolding & { artwork: ArtworkSummary };

export function WalletOverview() {
  const { data: wallet } = useAggregatorWallet();
  const { data: holdings } = useAggregatorCollection();
  const { data: transactions } = useAggregatorWalletTransactions();
  const { data: profile } = useAggregatorProfile();
  const updateProfileMutation = useUpdateAggregatorProfileMutation();

  // Only reserved holdings carry held money. Sold-pending-settlement
  // has its hold released on the sale posting; returned holdings have
  // their hold released on the return posting. If the ledger and the
  // holdings list disagree the ledger wins — use it for the HEADER
  // number, and use the holdings for the per-row breakdown.
  const activeHoldings = (holdings ?? []).filter((h) => h.status === "reserved");
  const balance = wallet?.balance ?? 0;
  const locked = wallet?.lockedBalance ?? 0;
  const owed = balance - locked;

  const summaryCards = [
    {
      key: "owed",
      label: "Owed to you",
      value: owed,
      hint: "Commission GalleryZone will transfer to your bank after each clearing cycle.",
      icon: Landmark,
      tone: "gold" as const,
    },
    {
      key: "held",
      label: "Held in escrow against reservations",
      value: locked,
      hint: "Advance + delivery you paid per piece. Released back to this balance when a piece sells or returned to GalleryZone if the delivery leg was consumed.",
      icon: Lock,
      tone: "neutral" as const,
    },
    {
      key: "pending",
      label: "Commission clearing",
      value: wallet?.pendingBalance ?? 0,
      hint: "Earned on sales, waiting for delivery to confirm before it moves to 'Owed to you'.",
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
              {formatINR(card.value)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
          </motion.div>
        ))}
      </div>

      <EscrowExplainerCard />

      {/* Per-reservation held breakdown — the new piece.  The ledger-side
          total above is the single source of truth; this table itemises
          where each rupee of it is sitting. */}
      <HeldPerReservationCard holdings={activeHoldings} />

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

// Replaces the old AddFundsCard. There is no wallet to top up — the
// aggregator pays per-piece. This card states the money flow so
// nobody mistakes "Owed to you" for a self-serve withdrawal button.
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
            Pay the advance + delivery for each piece through Razorpay at the
            moment you reserve it. That money moves into escrow — held
            against the specific reservation, not spendable or withdrawable
            until the piece sells or returns. When a piece sells,
            GalleryZone takes its share, your commission moves into
            &ldquo;Owed to you&rdquo;, and we transfer it to your bank with
            a reference number you can match in your passbook.
          </p>
        </div>
      </div>
    </div>
  );
}

// Per-reservation held breakdown — the detail view below the
// three-card summary. The sum of (advance + delivery) across every
// reserved holding here must equal the "Held in escrow" number
// above; if it ever diverges the ledger is authoritative.
function HeldPerReservationCard({ holdings }: { holdings: HoldingRow[] }) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Held against reservations
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&rsquo;t have any active reservations right now. When you
          reserve a piece, the advance + delivery you pay through Razorpay
          will show up here with a clear release condition.
        </p>
      </div>
    );
  }

  const heldTotal = holdings.reduce(
    (sum, h) => sum + h.advanceAmount + (h.deliveryDeposit ?? 0),
    0,
  );

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Held against reservations
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Per-piece breakdown of what&rsquo;s in escrow right now.
          </p>
        </div>
        <span className="shrink-0 font-display text-xl font-semibold tabular-nums text-foreground">
          {formatINR(heldTotal)}
        </span>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-border">
        {holdings.map((h) => {
          const total = h.advanceAmount + (h.deliveryDeposit ?? 0);
          const expiresAt = new Date(h.expiresAt);
          const daysLeft = Math.max(
            0,
            Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000),
          );
          return (
            <li key={h.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {h.artwork.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Advance {formatINR(h.advanceAmount)}
                  {h.deliveryDeposit
                    ? ` · Delivery ${formatINR(h.deliveryDeposit)}`
                    : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Released when the piece{" "}
                  <span className="font-medium text-foreground">sells</span>;
                  {h.deliveryDeposit ? " delivery is forfeited if it returns unsold" : " refunded if it returns unsold"}.
                  {daysLeft > 0 && (
                    <>
                      {" · "}
                      {daysLeft} day{daysLeft === 1 ? "" : "s"} left in this
                      placement window
                    </>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                {formatINR(total)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Replaces the old WithdrawCard. There is nothing to request — payouts
// leave GalleryZone's escrow on a fixed cadence against the "Owed to
// you" figure above. This card just confirms where that money lands.
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
        Escrow transaction history
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
        {isCredit ? "+" : "−"}{formatINR(Math.abs(tx.amount))}
      </span>
    </div>
  );
}
