import { ArtworkEditView } from "@/features/dashboard/artwork-edit-view";

export const metadata = {
  title: "Edit Artwork | GalleryZone Artist Dashboard",
};

export default async function EditArtworkPage({
  params,
}: PageProps<"/dashboard/artworks/[artworkId]/edit">) {
  const { artworkId } = await params;
  return <ArtworkEditView artworkId={artworkId} />;
}
