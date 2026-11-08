import { useQuery } from "@tanstack/react-query";
import { quoteService, type CheckoutQuote } from "@/services/quoteService";

/**
 * The API's own checkout breakdown for one artwork.
 *
 * Pass [addressId] on the checkout review step so the delivery line reflects
 * the real ShipRocket rate for that address's pincode. Without it the public
 * endpoint falls back to the flat delivery charge from the rate config —
 * fine for the artwork-detail preview, wrong for the review page right
 * before the buyer pays.
 */
export function useCheckoutQuote(artworkId: string, addressId?: string) {
  return useQuery<CheckoutQuote>({
    queryKey: ["checkout-quote", artworkId, addressId ?? null],
    queryFn: () =>
      addressId
        ? quoteService.getForAddress(artworkId, addressId)
        : quoteService.get(artworkId),
    enabled: Boolean(artworkId),
    staleTime: 60_000,
  });
}
