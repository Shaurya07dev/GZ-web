import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminEwayBillsService,
  type CancelEwayBillInput,
  type ExtendEwayBillInput,
} from "@/services/adminEwayBillsService";

export function useAdminEwayBills() {
  return useQuery({
    queryKey: ["admin-eway-bills"],
    queryFn: () => adminEwayBillsService.list(),
  });
}

export function useCancelEwayBillMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelEwayBillInput) =>
      adminEwayBillsService.cancel(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-eway-bills"] });
    },
  });
}

export function useExtendEwayBillMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExtendEwayBillInput) =>
      adminEwayBillsService.extend(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-eway-bills"] });
    },
  });
}
