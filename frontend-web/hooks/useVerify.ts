import { useQuery } from "@tanstack/react-query";
import { verifyService } from "@/services/verifyService";

// ['verify', artworkId] — the public passport. Separate key from
// ['artwork', id] because it changes on every ownership event, not just
// when the listing does.
export function useVerifyPassport(artworkId: string) {
  return useQuery({
    queryKey: ["verify", artworkId],
    queryFn: () => verifyService.get(artworkId),
    enabled: Boolean(artworkId),
  });
}
