"use client";

import { motion } from "framer-motion";
import { Wallet, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useCustomerWallet,
  useCustomerWalletTransactions,
} from "@/hooks/useCustomerWallet";
import type { WalletTransaction } from "@/features/dashboard/dashboard-data";
import {
  useCustomerProfile,
  useUpdateProfileMutation,
} from "@/hooks/useCustomerProfile";
import { GstNumberCard } from "@/components/shared/gst-number-card";

// Deliberately simpler than the Artist/Aggregator wallets: no withdrawal
// form here (see customerWalletService's comment — this balance is refund
// credit, not earnings a collector cashes out).
export function CollectorWalletOverview() {
  const { data: wallet } = useCustomerWallet();
  const { data: transactions } = useCustomerWalletTransactions();
  const { data: profile } = useCustomerProfile();
  const updateProfileMutation = useUpdateProfileMutation();

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-1 rounded-lg border border-gold/30 bg-gold/5 p-6"
      >
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-gold-bright" strokeWidth={1.75} />
          <span className="text-sm text-muted-foreground">Store credit</span>
        </div>
        <p className="font-display text-3xl font-semibold tabular-nums text-foreground">
          ₹{(wallet?.balance ?? 0).toLocaleString("en-IN")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Refunds and cancellations credit here automatically, and apply at
          your next checkout.
        </p>
      </motion.div>

      <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Transaction history
        </h2>

        <div className="mt-3 flex flex-col">
          {!transactions || transactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No transactions yet"
              description="Refunds and store credit adjustments will show up here."
              className="border-0 py-10"
            />
          ) : (
            transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </div>
      </div>
      {profile && (
        <GstNumberCard
          value={profile.gstin ?? ""}
          onSave={(gstin) => updateProfileMutation.mutate({ gstin })}
          isPending={updateProfileMutation.isPending}
          isSuccess={updateProfileMutation.isSuccess}
          description="Add it if you need GST invoices for your purchases — for a business or an office collection, say."
        />
      )}
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
