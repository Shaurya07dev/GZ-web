import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/adminApi";
import type {
  CategoryPerformance,
  FunnelStage,
  RangeKey,
  RevenuePoint,
  TierDistribution,
  TopPerformer,
  UserGrowthPoint,
  VolumePoint,
} from "@/types/admin-analytics";

// Every admin analytics series, computed from real orders, artworks and
// users. Buckets with no activity are zero — a fresh platform shows flat
// lines, never invented traffic. Revenue split: artist net = displayPrice
// less GST less the markup that the artist's own price implies; here we
// take the API's paid orders and attribute GST to the platform column
// until settlements are aggregated server-side.

const PAID = new Set(["paid", "confirmed", "packed", "transit", "delivered"]);

function buckets(range: RangeKey): { key: (d: Date) => string; labels: { key: string; label: string }[] } {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  if (range === "30d") {
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      out.push({ key: d.toISOString().slice(0, 10), label: `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}` });
    }
    return { key: (d) => d.toISOString().slice(0, 10), labels: out };
  }
  if (range === "90d") {
    for (let i = 12; i >= 0; i -= 1) {
      const d = new Date(now); d.setDate(now.getDate() - i * 7);
      out.push({ key: weekKey(d), label: `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}` });
    }
    return { key: weekKey, labels: out };
  }
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-IN", { month: "short" }) });
  }
  return { key: (d) => `${d.getFullYear()}-${d.getMonth()}`, labels: out };
}

function weekKey(d: Date): string {
  const start = new Date(d); start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

export function useAdminAnalytics(range: RangeKey) {
  const orders = useQuery({ queryKey: ["admin-orders"], queryFn: () => adminApi.listOrders(), staleTime: 60_000 });
  const artworks = useQuery({ queryKey: ["admin-artworks"], queryFn: () => adminApi.listAllArtworks(), staleTime: 60_000 });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => adminApi.listUsers(), staleTime: 60_000 });

  return useMemo(() => {
    const paid = (orders.data ?? []).filter((o) => PAID.has(o.status));
    const { key, labels } = buckets(range);
    const artworkById = new Map((artworks.data ?? []).map((a) => [a.id, a]));

    const revenue: RevenuePoint[] = labels.map((b) => ({ label: b.label, gmv: 0, platform: 0, artist: 0, aggregator: 0 }));
    const volume: VolumePoint[] = labels.map((b) => ({ label: b.label, orders: 0 }));
    const index = new Map(labels.map((b, i) => [b.key, i]));
    for (const o of paid) {
      const i = index.get(key(new Date(o.createdAt)));
      if (i === undefined) continue;
      const gmv = o.amount + o.deliveryCharge;
      const artistNet = artworkById.get(o.artworkId) && "artistPrice" in (artworkById.get(o.artworkId) as object) ? ((artworkById.get(o.artworkId) as { artistPrice?: number }).artistPrice ?? 0) : 0;
      revenue[i]!.gmv += gmv;
      revenue[i]!.artist += artistNet;
      revenue[i]!.platform += Math.max(0, gmv - artistNet);
      volume[i]!.orders += 1;
    }

    const growth: UserGrowthPoint[] = labels.map((b) => ({ label: b.label, artists: 0, aggregators: 0, customers: 0 }));
    const cumulative = { artists: 0, aggregators: 0, customers: 0 };
    const sortedUsers = [...(users.data ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const firstKey = labels[0]?.key;
    for (const u of sortedUsers) {
      const k = key(new Date(u.createdAt));
      const i = index.get(k);
      const bucket = u.role === "artist" ? "artists" : u.role === "aggregator" ? "aggregators" : u.role === "customer" ? "customers" : null;
      if (!bucket) continue;
      if (i === undefined) {
        // Before the window: counts into the opening balance.
        if (firstKey && k < firstKey) cumulative[bucket] += 1;
        continue;
      }
      cumulative[bucket] += 1;
      for (let j = i; j < growth.length; j += 1) growth[j]![bucket] = Math.max(growth[j]![bucket], cumulative[bucket]);
    }
    // Carry the running total forward across empty buckets.
    let run = { artists: 0, aggregators: 0, customers: 0 };
    for (const g of growth) {
      run = { artists: Math.max(run.artists, g.artists), aggregators: Math.max(run.aggregators, g.aggregators), customers: Math.max(run.customers, g.customers) };
      g.artists = run.artists; g.aggregators = run.aggregators; g.customers = run.customers;
    }

    const byCategory = new Map<string, CategoryPerformance>();
    for (const o of paid) {
      const a = artworkById.get(o.artworkId);
      const category = a?.category ?? "Other";
      const row = byCategory.get(category) ?? { category, revenue: 0, orders: 0 };
      row.revenue += o.amount + o.deliveryCharge;
      row.orders += 1;
      byCategory.set(category, row);
    }
    const categoryPerformance = [...byCategory.values()].sort((a, b) => b.revenue - a.revenue);

    const all = artworks.data ?? [];
    const funnel: FunnelStage[] = [
      { stage: "Submitted", count: all.filter((a) => a.status !== "draft").length },
      { stage: "Approved", count: all.filter((a) => !["draft", "pending_approval", "returned"].includes(a.status)).length },
      { stage: "Listed", count: all.filter((a) => a.status === "marketplace").length },
      { stage: "Sold", count: all.filter((a) => ["sold", "settlement_complete", "delivered", "completed"].includes(a.status)).length },
    ];

    const artistsList = (users.data ?? []).filter((u) => u.role === "artist");
    const tiers: TierDistribution[] = [
      { tier: "Unverified", count: artistsList.filter((u) => !u.instagramHandle).length },
      { tier: "Tier 1", count: artistsList.filter((u) => Boolean(u.instagramHandle)).length },
      { tier: "Tier 3", count: new Set(paid.map((o) => artworkById.get(o.artworkId)?.artistId).filter(Boolean)).size },
    ];

    const byArtist = new Map<string, TopPerformer>();
    for (const o of paid) {
      const a = artworkById.get(o.artworkId);
      if (!a) continue;
      const row = byArtist.get(a.artistId) ?? { name: a.artistName, revenue: 0, count: 0 };
      row.revenue += o.amount + o.deliveryCharge;
      row.count += 1;
      byArtist.set(a.artistId, row);
    }
    const topArtists = [...byArtist.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      isPending: orders.isPending || artworks.isPending || users.isPending,
      revenue,
      volume,
      growth,
      categoryPerformance,
      funnel,
      tiers,
      topArtists,
      topAggregators: [] as TopPerformer[],
    };
  }, [orders.data, orders.isPending, artworks.data, artworks.isPending, users.data, users.isPending, range]);
}
