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
