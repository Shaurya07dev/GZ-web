import type { Metadata } from "next";
import { HoldingDetail } from "@/features/aggregator/holding-detail";

export const metadata: Metadata = {
  title: "Holding | GalleryZone Aggregator Portal",
};

export default async function AggregatorHoldingDetailPage(
  props: PageProps<"/aggregator/collection/[holdingId]">,
) {
  const { holdingId } = await props.params;
  return <HoldingDetail holdingId={holdingId} />;
}
