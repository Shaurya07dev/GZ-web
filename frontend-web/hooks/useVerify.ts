import { useQuery } from "@tanstack/react-query";
import { useMounted } from "@/hooks/useMounted";
import { useSessionRole } from "@/hooks/useSessionRole";
import { verifyService } from "@/services/verifyService";

// ['verify', artworkId, viewer] — the passport. Separate key from
// ['artwork', id] because it changes on every ownership event, not just
// when the listing does. The answer depends on who asks: only the piece's
// owner, its artist or an admin get the certificate fields, everyone else gets
// the passport without them. So the signed-in role is part of the key, and the
// request waits for hydration so a signed-in person never gets a first,
// signed-out answer cached under their key.
export function useVerifyPassport(artworkId: string) {
  const mounted = useMounted();
  const role = useSessionRole();
  return useQuery({
    queryKey: ["verify", artworkId, role ?? "anon"],
    queryFn: () => verifyService.get(artworkId),
    enabled: Boolean(artworkId) && mounted,
  });
}
