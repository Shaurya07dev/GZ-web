import { http } from "@/lib/api";
import { paiseToRupees } from "@/lib/api-mappers";

// What an artwork actually costs at checkout, quoted by the API from the
// pricing rules in force right now (GET /v1/artworks/:id/quote). The
// checkout screens render this instead of recomputing the ladder locally,
// so a preview can never disagree with the order the API then creates —
// and an admin changing a rate moves every screen at once.

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

export const quoteService = {
  get: async (artworkId: string): Promise<CheckoutQuote> => {
    const dto = await http.get<QuoteDto>(`/v1/artworks/${encodeURIComponent(artworkId)}/quote`);
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
  },
};
