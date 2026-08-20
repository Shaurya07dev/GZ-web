import type { Metadata } from "next";
import { GallerySpacesBoard } from "@/features/aggregator/gallery-spaces-board";

export const metadata: Metadata = {
  title: "Display Spaces | GalleryZone Aggregator Portal",
};

export default function AggregatorGallerySpacesPage() {
  return <GallerySpacesBoard />;
}
