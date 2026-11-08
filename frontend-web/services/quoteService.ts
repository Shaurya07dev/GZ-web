import { http } from "@/lib/api";
import { paiseToRupees } from "@/lib/api-mappers";

// What an artwork actually costs at checkout, quoted by the API from the
// pricing rules in force right now. Two endpoints:
//
//   GET /v1/artworks/:id/quote                      (public, flat delivery)
//   GET /v1/orders/quote?artworkId=&addressId=      (auth, real ShipRocket
//                                                    rate for the drop pincode)
//
// Artwork-detail previews call `get()` because no address exists yet; the
// checkout review step calls `getForAddress()` so the delivery line matches
// what POST /v1/orders will actually debit. 8 Nov 2026: client reported a
// flat ₹25 on the review page regardless of selected address — this was the
// public endpoint silently falling back to `rates.deliveryChargePaise`.

export interface CheckoutQuote {
  artworkId: string;
  displayPrice: number;
  gstIncluded: number;
  /** The artwork GST rate in force, as a fraction (0.05 = 5%). */
  gstRate: number;
  convenienceFee: number;
  convenienceGst: number;
  deliveryCharge: number;
  total: number;
}

interface QuoteDto {
  artworkId: string;
  displayPricePaise: number;
  gstPaise: number;
  gstRate: number;
  convenienceFeePaise: number;
  convenienceGstPaise: number;
  deliveryChargePaise: number;
  totalPaise: number;
}

function fromDto(dto: QuoteDto): CheckoutQuote {
  return {
    artworkId: dto.artworkId,
    displayPrice: paiseToRupees(dto.displayPricePaise),
    gstIncluded: paiseToRupees(dto.gstPaise),
    gstRate: dto.gstRate,
    convenienceFee: paiseToRupees(dto.convenienceFeePaise),
    convenienceGst: paiseToRupees(dto.convenienceGstPaise),
    deliveryCharge: paiseToRupees(dto.deliveryChargePaise),
    total: paiseToRupees(dto.totalPaise),
  };
}

export const quoteService = {
  get: async (artworkId: string): Promise<CheckoutQuote> =>
    fromDto(await http.get<QuoteDto>(`/v1/artworks/${encodeURIComponent(artworkId)}/quote`)),

  getForAddress: async (artworkId: string, addressId: string): Promise<CheckoutQuote> =>
    fromDto(
      await http.get<QuoteDto>(
        `/v1/orders/quote?artworkId=${encodeURIComponent(artworkId)}&addressId=${encodeURIComponent(addressId)}`,
      ),
    ),
};
