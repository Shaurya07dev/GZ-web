import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/api";

// The pricing rules an admin manages (GET /v1/pricing-rules). Any screen that
// quotes a rate — the artist's upload ladder, fee explainers — reads them
// from here, so an approved rate change is live everywhere without a deploy.

export interface PricingRules {
  gstRate: number;
  platformMarkup: number;
  artistListingFeeRate: number;
  serviceGstRate: number;
  artistTdsRate: number;
  artistConvenienceRate: number;
  aggregatorCommissionRate: number;
  aggregatorAdvanceRate: number;
  nfcTagChargePaise: number;
  subscriptionFeePaise: number;
  deliveryChargePaise: number;
  insuranceThresholdPaise: number;
  [key: string]: number | unknown;
}

export function usePricingRules() {
  return useQuery<PricingRules | null>({
    queryKey: ["pricing-rules"],
    queryFn: async () => (await http.get<{ rates: PricingRules | null }>("/v1/pricing-rules")).rates,
    staleTime: 5 * 60_000,
  });
}
