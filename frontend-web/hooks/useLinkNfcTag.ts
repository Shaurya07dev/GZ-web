import { useMutation, useQueryClient } from "@tanstack/react-query";
import { nfcTagService, generateNfcTagId } from "@/services/nfcTagService";

/**
 * Mutation hook to link a physical NFC tag to an artwork.
 * On success it invalidates the artist-artworks query so the NfcPill in the
 * COA board refreshes immediately without a manual page reload.
 */
export function useLinkNfcTagMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artworkId }: { artworkId: string }) => {
      const tagId = generateNfcTagId();
      return nfcTagService.linkTag(artworkId, tagId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["artist-artworks"] });
      // The verify passport carries nfcTagId; invalidate it too so the public
      // page reflects the new tag without waiting for the next revalidation.
      queryClient.invalidateQueries({ queryKey: ["verify"] });
    },
  });
}
