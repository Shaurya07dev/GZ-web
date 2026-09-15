"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { http, isApiError } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// The platform's pricing rules (GST, markup, commissions, delivery, payout
// timing) live on the API as versioned "rate config". A version is
// proposed by one platform admin and must be approved by a DIFFERENT one
// before it takes effect — checkout refuses to run without an approved
// version, so this panel is the first thing a fresh deployment needs.

interface RateVersion {
  id: string;
  rates: Record<string, unknown>;
  effectiveFrom: string | null;
  proposedBy: string;
  proposedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approved: boolean;
  reason: string | null;
}

const PERCENT_KEYS = new Set([
  "gstRate",
  "platformMarkup",
  "artistListingFeeRate",
  "aggregatorAdvanceRate",
  "aggregatorCommissionRate",
  "artistConvenienceRate",
  "externalSalePenaltyRate",
]);
const PAISE_KEYS = new Set(["customerConvenienceFee", "deliveryCharge", "minWithdrawalPaise", "minCustomerWithdrawalPaise"]);

function describe(key: string, value: unknown): string {
  if (typeof value === "number") {
    if (PERCENT_KEYS.has(key)) return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 2)}%`;
    if (PAISE_KEYS.has(key)) return `₹${(value / 100).toLocaleString("en-IN")}`;
    return String(value);
  }
  if (Array.isArray(value)) return value.length > 8 ? `${value.length} entries` : value.join(", ");
  if (value && typeof value === "object") return `${Object.keys(value).length} zones`;
  return String(value);
}

function label(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(" Paise", "");
}

export function PricingRulesPanel() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const isPlatformAdmin = me?.roleGrants.includes("platform_admin") ?? false;
  const [reason, setReason] = useState("Launch pricing rules");

  const active = useQuery({
    queryKey: ["rate-config", "active"],
    queryFn: () => http.get<{ rates: Record<string, unknown> }>("/v1/admin/rate-config"),
    retry: false,
  });
  const versions = useQuery({
    queryKey: ["rate-config", "versions"],
    queryFn: () => http.get<{ versions: RateVersion[] }>("/v1/admin/rate-config/versions"),
  });
  const defaults = useQuery({
    queryKey: ["rate-config", "defaults"],
    queryFn: () => http.get<{ rates: Record<string, unknown> }>("/v1/admin/rate-config/defaults"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["rate-config"] });
  };

  const propose = useMutation({
    mutationFn: () =>
      http.post<{ versionId: string }>("/v1/admin/rate-config/propose", {
        rates: defaults.data?.rates,
        effectiveFrom: new Date().toISOString(),
        reason,
      }),
    onSuccess: () => {
      toast.success("Proposed — a second platform admin must approve it");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not propose"),
  });

  const approve = useMutation({
    mutationFn: (versionId: string) => http.post(`/v1/admin/rate-config/${encodeURIComponent(versionId)}/approve`),
    onSuccess: () => {
      toast.success("Approved — pricing rules are live");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  const noActive = active.isError && isApiError(active.error) && active.error.status >= 400;
  const pending = versions.data?.versions.filter((v) => !v.approved) ?? [];
  const rates = active.data?.rates;

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">Pricing rules</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            GST, markup, commissions, delivery and payout timing. Proposed by one platform admin, approved by another.
          </p>
        </div>
        {rates ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-3 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" /> Active version in force
          </span>
        ) : noActive || (!active.isPending && !rates) ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <Clock3 className="size-3.5" /> No approved version — checkout is blocked
          </span>
        ) : null}
      </div>

      {rates && (
        <dl className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(rates).map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-sm">
              <dt className="text-muted-foreground">{label(key)}</dt>
              <dd className="font-mono text-foreground tabular-nums">{describe(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}

      {pending.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Awaiting approval</p>
          {pending.map((v) => {
            const mine = v.proposedBy === me?.uid;
            return (
              <div key={v.id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{v.reason ?? "Rate change"}</p>
                  <p className="text-xs text-muted-foreground">
                    Proposed {v.proposedAt ? new Date(v.proposedAt).toLocaleString("en-IN") : ""}
                    {mine ? " · by you — someone else must approve" : ""}
                  </p>
                </div>
                <Button size="sm" disabled={!isPlatformAdmin || mine || approve.isPending} onClick={() => approve.mutate(v.id)}>
                  <CheckCircle2 className="size-4" /> Approve
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
          Reason for the new version
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <Button variant="outline" disabled={!isPlatformAdmin || !defaults.data || propose.isPending || reason.trim().length < 10} onClick={() => propose.mutate()}>
          {propose.isPending ? "Proposing…" : "Propose default rules"}
        </Button>
      </div>
      {!isPlatformAdmin && (
        <p className="mt-2 text-xs text-muted-foreground">Only accounts with the platform_admin grant can propose or approve.</p>
      )}
    </section>
  );
}
