"use client";

import { useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  Clock3,
  Lock,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WALLET_SUMMARY,
  WALLET_TRANSACTIONS,
  PROFILE,
  type WalletTransaction,
} from "./dashboard-data";

const MIN_WITHDRAWAL = 1000;

const SUMMARY_CARDS = [
  {
    key: "balance",
    label: "Available balance",
    value: WALLET_SUMMARY.balance,
    icon: Wallet,
    tone: "gold" as const,
  },
  {
    key: "pending",
    label: "Pending settlement",
    value: WALLET_SUMMARY.pendingBalance,
    icon: Clock3,
    tone: "neutral" as const,
  },
  {
    key: "locked",
    label: "Locked",
    value: WALLET_SUMMARY.lockedBalance,
    icon: Lock,
    tone: "neutral" as const,
  },
];

export function WalletOverview() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SUMMARY_CARDS.map((card, i) => (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
        <WithdrawCard />
        <TransactionsCard />
      </div>
    </div>
  );
}

function WithdrawCard() {
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const amountNumber = Number(amount) || 0;
  const belowMinimum = amount !== "" && amountNumber < MIN_WITHDRAWAL;
  const exceedsBalance = amountNumber > WALLET_SUMMARY.balance;
  const canSubmit =
    amountNumber >= MIN_WITHDRAWAL && amountNumber <= WALLET_SUMMARY.balance;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-start gap-3 rounded-lg border border-gold/30 bg-card p-6"
      >
        <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <Check className="size-5 text-gold-bright" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">
          Withdrawal requested.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          ₹{amountNumber.toLocaleString("en-IN")} will be sent to your bank
          account ending {PROFILE.bankAccountMasked.slice(-4)}. This typically
          takes 1–2 business days.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setAmount("");
          }}
          className="mt-1 text-sm font-medium text-gold-bright hover:underline"
        >
          Request another withdrawal
        </button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Withdraw funds
      </h2>

      <div className="flex items-center gap-3 rounded-md border border-border p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
          <Building2 className="size-4 text-gold-bright" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {PROFILE.bankAccountMasked}
          </p>
          <p className="text-xs text-muted-foreground">{PROFILE.ifsc}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Label htmlFor="withdrawAmount">Amount (₹)</Label>
        <Input
          id="withdrawAmount"
          type="number"
          min={MIN_WITHDRAWAL}
          step={1}
          placeholder="5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-10"
          aria-invalid={belowMinimum || exceedsBalance}
        />

        {belowMinimum ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3" />
            Minimum withdrawal is ₹1,000
          </p>
        ) : exceedsBalance ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3" />
            Exceeds your available balance
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Minimum ₹1,000 · Available ₹
            {WALLET_SUMMARY.balance.toLocaleString("en-IN")}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40"
        >
          Request withdrawal
        </button>
      </form>
    </div>
  );
}

function TransactionsCard() {
  const rows = useMemo(() => WALLET_TRANSACTIONS, []);

  return (
    <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Transaction history
      </h2>

      <div className="mt-3 flex flex-col">
        {rows.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} />
        ))}
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
