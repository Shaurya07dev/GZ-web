import type { Metadata } from "next";
import { ArtistBlogForm } from "@/features/dashboard/blogs/artist-blog-form";

export const metadata: Metadata = {
  title: "Write a blog | GalleryZone Artist Dashboard",
};

export default function ArtistBlogNewPage() {
  return <ArtistBlogForm />;
}
