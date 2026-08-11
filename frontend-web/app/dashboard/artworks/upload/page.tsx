import type { Metadata } from "next";
import { ArtworkSubmitForm } from "@/features/dashboard/artwork-submit-form";

export const metadata: Metadata = {
  title: "Submit Artwork — GalleryZone",
};

export default function SubmitArtworkPage() {
  return <ArtworkSubmitForm />;
}
