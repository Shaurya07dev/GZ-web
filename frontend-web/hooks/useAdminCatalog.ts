import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminService } from "@/services/adminService";
import type { ArtworkRarity } from "@/types/artwork";

// ---------------------------------------------------------------------------
// Catalog: the all-artworks table (public + admin-only sets combined), the
// admin artwork detail view, and category CRUD.
//
// The plan's Task 2 file list names five hook files grouped by area and does
// not say where the ["admin-artworks"] / ["admin-artwork", id] /
// ["admin-categories"] keys it specifies should live — Catalog is its own
// section in the nav and its own track (Tasks 10-11), so it gets its own file
// here rather than being wedged into Commerce or People. Query keys are
// exactly the ones the plan specifies.
// ---------------------------------------------------------------------------

export function useAdminArtworks() {
  return useQuery({
    queryKey: ["admin-artworks"],
    queryFn: () => adminService.listAllArtworks(),
  });
}

export function useAdminArtwork(artworkId: string) {
  return useQuery({
    queryKey: ["admin-artwork", artworkId],
    queryFn: () => adminService.getArtworkAdmin(artworkId),
    enabled: Boolean(artworkId),
  });
}

// Delisting pulls an artwork off the marketplace, which moves the overview's
// "active artworks" tile — hence the KPI invalidation.
export function useDelistArtworkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artworkId: string) => adminService.delistArtwork(artworkId),
    onSuccess: (_data, artworkId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-artworks"] });
      queryClient.invalidateQueries({ queryKey: ["admin-artwork", artworkId] });
      queryClient.invalidateQueries({ queryKey: ["admin-kpis"] });
    },
  });
}

// The rank shows on the public marketplace card, so the marketplace queries
// have to be dropped too — not just the admin ones.
export function useSetArtworkRarityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      artworkId,
      rarity,
    }: {
      artworkId: string;
      rarity: ArtworkRarity | null;
    }) => adminService.setArtworkRarity(artworkId, rarity),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-artworks"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-artwork", variables.artworkId],
      });
      queryClient.invalidateQueries({ queryKey: ["artworks"] });
      queryClient.invalidateQueries({ queryKey: ["artwork", variables.artworkId] });
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminService.listCategories(),
  });
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminService.createCategory(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      adminService.updateCategory(categoryId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });
}

// Rejects (via mockError) when the category still holds artworks — Task 11
// surfaces that message inline rather than as a bare toast.
export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) => adminService.deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });
}
