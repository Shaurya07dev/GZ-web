import { useQuery } from "@tanstack/react-query";
import { quoteService, type CheckoutQuote } from "@/services/quoteService";

/** The API's own checkout breakdown for one artwork. */
export function useCheckoutQuote(artworkId: string) {
  return useQuery<CheckoutQuote>({
    queryKey: ["checkout-quote", artworkId],
    queryFn: () => quoteService.get(artworkId),
    enabled: Boolean(artworkId),
    staleTime: 60_000,
  });
}
