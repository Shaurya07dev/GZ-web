import { useQuery } from "@tanstack/react-query";
import { artistDashboardService } from "@/services/artistDashboardService";

export function useArtistGallerySpaces() {
  return useQuery({
    queryKey: ["artist-gallery-spaces"],
    queryFn: () => artistDashboardService.listGallerySpaces(),
  });
}
