import type { Metadata } from "next";
import { GallerySpacesBoard } from "@/features/aggregator/gallery-spaces-board";

export const metadata: Metadata = {
  title: "Gallery Spaces | GalleryZone Aggregator Portal",
};

export default function AggregatorGallerySpacesPage() {
  return <GallerySpacesBoard />;
}
