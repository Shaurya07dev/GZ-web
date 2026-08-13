import { create } from "zustand";
import { persist } from "zustand/middleware";

// Client-side-only wishlist state for the mock phase. This is a deliberate,
// scoped exception to "server data never lives in Zustand" (SAD §5.5) —
// there is no /wishlist API yet. Once one exists, this store gets replaced
// by real TanStack Query mutation state and every `useWishlistStore()` call
// site swaps for the equivalent query hook; the `has`/`toggle` shape here is
// intentionally the same shape a query-backed hook would expose, so that
// swap is mechanical.
interface WishlistState {
  ids: string[];
  toggle: (artworkId: string) => void;
  has: (artworkId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (artworkId) =>
        set((state) => ({
          ids: state.ids.includes(artworkId)
            ? state.ids.filter((id) => id !== artworkId)
            : [...state.ids, artworkId],
        })),
      has: (artworkId) => get().ids.includes(artworkId),
    }),
    { name: "gz-wishlist" },
  ),
);
