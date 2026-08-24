import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorService } from "@/services/aggregatorService";
import type { RecordSalePayload } from "@/types/aggregator";

export function useAggregatorCollection() {
  return useQuery({
    queryKey: ["aggregator-collection"],
    queryFn: () => aggregatorService.listCollection(),
  });
}

// Recording a sale changes a holding's status in place within Collection
// and changes the "pending settlements" / "commission earned" KPIs on the
// Dashboard.
export function useRecordSaleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordSalePayload) =>
      aggregatorService.recordSale(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-collection"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["aggregator-wallet-transactions"],
      });
      queryClient.invalidateQueries({ queryKey: ["aggregator-sales"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-customers"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-shipments"] });
    },
  });
}

// Returning an unsold piece frees it for another aggregator, so Inventory has
// to be invalidated too — same set as reserving, in reverse.
export function useReleaseHoldingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holdingId: string) =>
      aggregatorService.releaseHolding(holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-collection"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["aggregator-wallet-transactions"],
      });
    },
  });
}
