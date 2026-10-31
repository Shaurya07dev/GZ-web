import { create } from "zustand";
import { persist } from "zustand/middleware";

// Audit §6: client-side cart, same pattern as the wishlist (SAD §5.5
// exception). Each entry is just an artworkId + the time the buyer added it;
// price, availability, and image come from `artworkService.get(id)` at render
// time so a sold or delisted piece naturally falls out of the list, exactly
// how the wishlist handles it. A cart API, if one ever lands, swaps this file
// for a TanStack Query mutation with the same hook shape.
//
// Max items per cart: 20. Art marketplace averages 1–3 items per order; 20
// gives collectors headroom without the "999 socks" cart that mainstream
// e-commerce platforms allow. If the limit is hit, add() returns false and the
// UI surfaces a toast.
export const CART_MAX_ITEMS = 20;

export interface CartEntry {
  artworkId: string;
  /** ISO timestamp — used by the abandoned-checkout trigger to decide which
   *  entries are "stale" (default: >24h). */
  addedAt: string;
}

interface CartState {
  entries: CartEntry[];
  /** Returns false if the cart is already full or the item is already in. */
  add: (artworkId: string) => boolean;
  remove: (artworkId: string) => void;
  clear: () => void;
  has: (artworkId: string) => boolean;
  count: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (artworkId) => {
        const { entries } = get();
        if (entries.some((e) => e.artworkId === artworkId)) return false;
        if (entries.length >= CART_MAX_ITEMS) return false;
        set({
          entries: [
            ...entries,
            { artworkId, addedAt: new Date().toISOString() },
          ],
        });
        return true;
      },
      remove: (artworkId) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.artworkId !== artworkId),
        })),
      clear: () => set({ entries: [] }),
      has: (artworkId) =>
        get().entries.some((e) => e.artworkId === artworkId),
      count: () => get().entries.length,
    }),
    { name: "gz-cart" },
  ),
);
