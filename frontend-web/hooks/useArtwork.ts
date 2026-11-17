import { useQuery } from "@tanstack/react-query";
import { artworkService } from "@/services/artworkService";

// Query key convention per SAD §5.4: ['artwork', id].
export function useArtwork(id: string) {
  return useQuery({
    queryKey: ["artwork", id],
    queryFn: () => artworkService.get(id),
    enabled: Boolean(id),
  });
}

/**
 * Live reservation state for one artwork. Polled every 10 seconds while
 * the artwork detail page is open so the Buy Now disabled state reflects
 * what another collector is doing right now. refetchIntervalInBackground
 * is false so a tab left open doesn't keep hitting the server when no
 * one's watching it. Added 16 Nov 2026 for concurrent-buyer protection.
 */
export function useArtworkReservation(id: string) {
  return useQuery({
    queryKey: ["artwork", id, "reservation"],
    queryFn: () => artworkService.reservation(id),
    enabled: Boolean(id),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}
