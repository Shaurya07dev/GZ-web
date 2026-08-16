import { useQuery } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";

export function useAggregatorGallerySpaces() {
  return useQuery({
    queryKey: ["aggregator-gallery-spaces"],
    queryFn: () => aggregatorSalesService.listGallerySpaces(),
  });
}
