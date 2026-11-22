import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aggregatorSalesService } from "@/services/aggregatorSalesService";
import { downloadAuthenticatedFile } from "@/lib/api";

export function useAggregatorSettlements() {
  return useQuery({
    queryKey: ["aggregator-settlements"],
    queryFn: () => aggregatorSalesService.listSettlements(),
  });
}

export function useRemittancesDue() {
  return useQuery({
    queryKey: ["aggregator-remittances"],
    queryFn: () => aggregatorSalesService.listRemittancesDue(),
  });
}

export function useRazorpayRemittanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleIds: string[]) =>
      aggregatorSalesService.payRemittanceViaRazorpay(saleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-remittances"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-sales"] });
    },
  });
}

export function useProcessSettlementMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) =>
      aggregatorSalesService.processSettlement(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aggregator-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["aggregator-wallet"] });
      queryClient.invalidateQueries({
        queryKey: ["aggregator-wallet-transactions"],
      });
    },
  });
}

/** Status of the commission tax invoice for a facilitated counter sale
 *  — stamped lazily on first download; starts as {snapshot: null}. */
export function useCommissionInvoice(saleId: string | null | undefined) {
  return useQuery({
    queryKey: ["aggregator-commission-invoice", saleId],
    queryFn: () => aggregatorSalesService.getCommissionInvoice(saleId!),
    enabled: Boolean(saleId),
  });
}

export function useAgreeCommissionInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleId: string) =>
      aggregatorSalesService.agreeCommissionInvoice(saleId),
    onSuccess: (_result, saleId) => {
      queryClient.invalidateQueries({
        queryKey: ["aggregator-commission-invoice", saleId],
      });
    },
  });
}

/** Mutation wrapper around the authenticated PDF download — the first
 *  download stamps the invoice number, so we also invalidate the
 *  invoice query so the UI picks up the freshly-minted number. */
export function useDownloadCommissionInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (saleId: string) => {
      const path = aggregatorSalesService.commissionInvoicePdfPath(saleId);
      await downloadAuthenticatedFile(path, `commission-invoice-${saleId}.pdf`);
      return saleId;
    },
    onSuccess: (saleId) => {
      queryClient.invalidateQueries({
        queryKey: ["aggregator-commission-invoice", saleId],
      });
    },
  });
}
