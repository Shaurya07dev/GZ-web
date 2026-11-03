// Shopping cart — moved from browser localStorage to the API on 31 Oct 2026
// so it syncs across devices (web + mobile). Public shape is unchanged for
// the call sites that already read `entries`, `has(id)`, `add(id)`,
// `remove(id)`, `count()`, so the UI didn't need a sweep.
//
// Server endpoints:
//   GET    /v1/me/cart                     the current cart (one doc per uid)
//   POST   /v1/me/cart/items {artworkId}   idempotent add (max 20 enforced server-side)
//   DELETE /v1/me/cart/items/:artworkId    remove
//   DELETE /v1/me/cart                     clear
//
// A signed-out user still gets a working, empty cart — the query simply
// returns [] because the API answered 401; we don't surface that as an
// error. Adding anything then prompts a sign-in via the usual API flow.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { http, isApiError } from "@/lib/api";

export const CART_MAX_ITEMS = 20;

export interface CartEntry {
  artworkId: string;
  addedAt: string;
}

interface CartDto {
  entries: CartEntry[];
}

const QUERY_KEY = ["cart"] as const;

async function fetchCart(): Promise<CartDto> {
  try {
    return await http.get<CartDto>("/v1/me/cart");
  } catch (error) {
    // Signed-out visitors get an empty cart rather than an error banner;
    // every other failure propagates.
    if (isApiError(error, 401) || isApiError(error, 403)) {
      return { entries: [] };
    }
    throw error;
  }
}

/**
 * React hook. Returns the current cart plus the same four mutating methods
 * the old zustand store exposed. Mutations update the TanStack cache
 * optimistically so the badge count never lags the button press.
 */
export function useCart() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCart,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: (artworkId: string) =>
      http.post<CartDto>("/v1/me/cart/items", { artworkId }),
    onSuccess: (next) => qc.setQueryData(QUERY_KEY, next),
  });
  const removeMutation = useMutation({
    mutationFn: (artworkId: string) =>
      http.delete<CartDto>(
        `/v1/me/cart/items/${encodeURIComponent(artworkId)}`,
      ),
    onSuccess: (next) => qc.setQueryData(QUERY_KEY, next),
  });
  const clearMutation = useMutation({
    mutationFn: () => http.delete<CartDto>("/v1/me/cart"),
    onSuccess: (next) => qc.setQueryData(QUERY_KEY, next),
  });

  const entries = query.data?.entries ?? [];

  return {
    entries,
    isPending: query.isPending,
    isError: query.isError,
    /** Returns a Promise so a caller can await success/failure. */
    add: (artworkId: string) => addMutation.mutateAsync(artworkId),
    remove: (artworkId: string) => removeMutation.mutateAsync(artworkId),
    clear: () => clearMutation.mutateAsync(),
    has: (artworkId: string) =>
      entries.some((e) => e.artworkId === artworkId),
    count: () => entries.length,
  };
}

/**
 * Imperative access for places that aren't inside a React render tree —
 * notably the checkout unmount cleanup, which fires after the component
 * is already gone. Reads the TanStack cache and posts straight to the API.
 */
export function cartActions(qc: QueryClient) {
  function current(): CartEntry[] {
    const data = qc.getQueryData<CartDto>(QUERY_KEY);
    return data?.entries ?? [];
  }
  return {
    has: (artworkId: string) =>
      current().some((e) => e.artworkId === artworkId),
    add: async (artworkId: string): Promise<boolean> => {
      try {
        const next = await http.post<CartDto>("/v1/me/cart/items", {
          artworkId,
        });
        qc.setQueryData(QUERY_KEY, next);
        return true;
      } catch {
        return false;
      }
    },
  };
}
