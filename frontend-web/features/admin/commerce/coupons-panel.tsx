"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/utils";
import {
  couponsAdminService,
  type AdminCoupon,
} from "@/services/couponsAdminService";

export function CouponsPanel() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => couponsAdminService.list(),
  });
  const [creating, setCreating] = useState(false);

  const togglePause = useMutation({
    mutationFn: ({ code, status }: { code: string; status: "active" | "paused" }) =>
      couponsAdminService.setStatus(code, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Couldn't update the coupon");
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.length} coupon${data.length === 1 ? "" : "s"}` : ""}
        </p>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New coupon
        </Button>
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn&rsquo;t load coupons.</p>
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No coupons yet. Create one to offer a marketplace discount.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Floor</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Per user</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <Row key={c.code} coupon={c} onToggle={togglePause.mutate} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating ? (
        <CreateCouponDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
          }}
        />
      ) : null}
    </div>
  );
}

function Row({
  coupon,
  onToggle,
}: {
  coupon: AdminCoupon;
  onToggle: (input: { code: string; status: "active" | "paused" }) => void;
}) {
  const discount =
    coupon.kind === "percent"
      ? `${coupon.value}%${coupon.maxDiscountPaise ? ` (max ${formatINR(coupon.maxDiscountPaise / 100)})` : ""}`
      : formatINR(coupon.value / 100);
  const window = `${new Date(coupon.validFrom).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })} → ${new Date(coupon.validUntil).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })}`;
  const used = coupon.usageCap ? `${coupon.usedCount}/${coupon.usageCap}` : `${coupon.usedCount}`;
  const scopeLabel = coupon.scope === "both" ? "Both" : coupon.scope === "marketplace" ? "Marketplace" : "Aggregator";
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3.5 font-mono text-foreground uppercase">
        {coupon.code}
        {coupon.artistIds && coupon.artistIds.length > 0 ? (
          <div className="mt-0.5 text-xs text-muted-foreground font-sans normal-case">
            {coupon.artistIds.length} artist{coupon.artistIds.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3.5 text-foreground">{discount}</td>
      <td className="px-4 py-3.5 text-muted-foreground">{scopeLabel}</td>
      <td className="px-4 py-3.5 text-muted-foreground">
        {coupon.minOrderPaise ? formatINR(coupon.minOrderPaise / 100) : "—"}
      </td>
      <td className="px-4 py-3.5 text-muted-foreground">{window}</td>
      <td className="px-4 py-3.5 text-foreground tabular-nums">{used}</td>
      <td className="px-4 py-3.5 text-muted-foreground tabular-nums">
        {coupon.perUserCap ?? "—"}
      </td>
      <td className="px-4 py-3.5">
        <span
          className={
            coupon.status === "active"
              ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"
              : coupon.status === "paused"
                ? "rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400"
                : "rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
          }
        >
          {coupon.status}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right">
        {coupon.status !== "expired" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onToggle({
                code: coupon.code,
                status: coupon.status === "active" ? "paused" : "active",
              })
            }
          >
            {coupon.status === "active" ? (
              <>
                <Pause className="size-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                Resume
              </>
            )}
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

function CreateCouponDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState<string>("10");
  const [minOrder, setMinOrder] = useState<string>("");
  const [maxDiscount, setMaxDiscount] = useState<string>("");
  const [validFrom, setValidFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  );
  const [usageCap, setUsageCap] = useState<string>("");
  const [perUserCap, setPerUserCap] = useState<string>("");
  const [scope, setScope] = useState<"marketplace" | "aggregator" | "both">("marketplace");
  const [artistIds, setArtistIds] = useState<string>("");

  const create = useMutation({
    mutationFn: () => {
      const parsedValue = Number(value);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error("Value must be a positive number");
      }
      if (kind === "percent" && parsedValue > 100) {
        throw new Error("Percent coupons can't be above 100");
      }
      const parsedArtistIds = artistIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return couponsAdminService.create({
        code: code.trim(),
        kind,
        value: kind === "percent" ? parsedValue : Math.round(parsedValue * 100),
        minOrderPaise: minOrder ? Math.round(Number(minOrder) * 100) : null,
        maxDiscountPaise: maxDiscount ? Math.round(Number(maxDiscount) * 100) : null,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        usageCap: usageCap ? Math.round(Number(usageCap)) : null,
        perUserCap: perUserCap ? Math.round(Number(perUserCap)) : null,
        scope,
        artistIds: parsedArtistIds.length > 0 ? parsedArtistIds : null,
      });
    },
    onSuccess: () => {
      toast.success("Coupon created");
      onCreated();
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Couldn't create the coupon");
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !create.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New coupon</DialogTitle>
          <DialogDescription>
            Marketplace discount only. Discount is absorbed by platform revenue
            — artist and aggregator payouts are untouched.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-2">
            <Label htmlFor="c-code">Code (3-24 letters/digits)</Label>
            <Input
              id="c-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={24}
              placeholder="DIWALI25"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="c-kind">Kind</Label>
              <select
                id="c-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "percent" | "flat")}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="percent">Percent off</option>
                <option value="flat">Flat ₹ off</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-value">
                {kind === "percent" ? "Percent (1-100)" : "Rupees off"}
              </Label>
              <Input
                id="c-value"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                min={1}
                step={kind === "percent" ? 1 : 10}
              />
            </div>
          </div>
          {kind === "percent" ? (
            <div className="grid gap-2">
              <Label htmlFor="c-max">Max discount in ₹ (optional cap)</Label>
              <Input
                id="c-max"
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(e.target.value)}
                min={0}
                placeholder="e.g. 2000"
              />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="c-floor">Minimum order in ₹ (optional)</Label>
            <Input
              id="c-floor"
              type="number"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              min={0}
              placeholder="e.g. 1000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="c-from">Valid from</Label>
              <Input
                id="c-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-until">Valid until</Label>
              <Input
                id="c-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="c-cap">Total redemptions</Label>
              <Input
                id="c-cap"
                type="number"
                value={usageCap}
                onChange={(e) => setUsageCap(e.target.value)}
                min={1}
                placeholder="optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="c-per-user">Per customer</Label>
              <Input
                id="c-per-user"
                type="number"
                value={perUserCap}
                onChange={(e) => setPerUserCap(e.target.value)}
                min={1}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-scope">Where the code works</Label>
            <select
              id="c-scope"
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as "marketplace" | "aggregator" | "both")
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="marketplace">Marketplace only</option>
              <option value="aggregator">Aggregator sales only</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-artists">Restrict to artists (optional)</Label>
            <Input
              id="c-artists"
              value={artistIds}
              onChange={(e) => setArtistIds(e.target.value)}
              placeholder="comma-separated artist uids"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to apply to any artist&rsquo;s piece.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={
              create.isPending || !/^[A-Z0-9]{3,24}$/.test(code.trim())
            }
          >
            {create.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Creating
              </>
            ) : (
              "Create coupon"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
