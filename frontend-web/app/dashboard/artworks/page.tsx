import type { Metadata } from "next";
import { ArtworksBoard } from "@/features/dashboard/artworks-board";

export const metadata: Metadata = {
  title: "My Artworks | GalleryZone",
};

export default function DashboardArtworksPage() {
  return <ArtworksBoard />;
}
