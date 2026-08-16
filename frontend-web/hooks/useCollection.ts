import { useQuery } from "@tanstack/react-query";
import { customerCollectionService } from "@/services/customerCollectionService";

export function useCollection() {
  return useQuery({
    queryKey: ["customer-collection"],
    queryFn: () => customerCollectionService.list(),
  });
}
