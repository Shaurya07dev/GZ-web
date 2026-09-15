import { useQuery } from "@tanstack/react-query";
import { artistService, statsService } from "@/services/artworkService";

export function useArtistDirectory() {
  return useQuery({ queryKey: ["artists", "directory"], queryFn: () => artistService.list(), staleTime: 60_000 });
}

export function usePublicStats() {
  return useQuery({ queryKey: ["stats", "public"], queryFn: () => statsService.publicStats(), staleTime: 5 * 60_000 });
}
