import type { Metadata } from "next";
import { ReserveArtworkPage } from "@/features/aggregator/reserve-artwork-page";

export const metadata: Metadata = {
  title: "Reserve Artwork | GalleryZone Aggregator Portal",
};

export default async function AggregatorReserveArtworkPage(
  props: PageProps<"/aggregator/inventory/[artworkId]/reserve">,
) {
  const { artworkId } = await props.params;
  return <ReserveArtworkPage artworkId={artworkId} />;
}
