"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { http } from "@/lib/api";

// Wishlist, backed by GET/POST/DELETE /v1/me/wishlist on the API.
//
// 8 Nov 2026 — replaced a client-only Zustand store. The old store persisted
// to localStorage, which meant a saved artwork was lost on another device
// and did not count toward anything server-side (an artist's "who saved
// this" view, abandoned-wishlist emails, future recommendations).
//
// The hook keeps the *same* `has`/`toggle`/`ids` shape as the previous
// store so no callsite has to change — but the state is a single
// TanStack Query, with optimistic add/remove that rolls back on failure.

interface WishlistEntry {
  artworkId: string;
  addedAt: string;
}

async function fetchWishlist(): Promise<string[]> {
  try {
    const dto = await http.get<{ entries: WishlistEntry[] }>("/v1/me/wishlist");
    return dto.entries.map((e) => e.artworkId);
  } catch {
    // Signed-out visitors get 401 — show an empty wishlist, no toast.
    return [];
  }
}

const WISHLIST_KEY = ["wishlist"] as const;

/** Mirrors the old Zustand store API: `ids`, `has`, `toggle`. */
export function useWishlistStore<T = { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void }>(
  selector?: (state: { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void }) => T,
): T {
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: fetchWishlist,
    staleTime: 60_000,
  });
  const ids = data ?? [];

  const has = useCallback((artworkId: string) => ids.includes(artworkId), [ids]);

  const toggle = useCallback(
    async (artworkId: string) => {
      const wasIn = ids.includes(artworkId);
      // Optimistic: flip the cache now; roll back on error.
      client.setQueryData<string[]>(
        WISHLIST_KEY,
        wasIn ? ids.filter((id) => id !== artworkId) : [...ids, artworkId],
      );
      try {
        if (wasIn) {
          await http.delete(`/v1/me/wishlist/items/${encodeURIComponent(artworkId)}`);
        } else {
          await http.post("/v1/me/wishlist/items", { artworkId });
        }
      } catch (error) {
        client.setQueryData<string[]>(WISHLIST_KEY, ids);
        throw error;
      }
    },
    [ids, client],
  );

  const state = { ids, has, toggle };
  return (selector ? selector(state) : (state as unknown as T));
}
