import type { Metadata } from "next";
import { ArtistBlogList } from "@/features/dashboard/blogs/artist-blog-list";

export const metadata: Metadata = {
  title: "Blogs | GalleryZone Artist Dashboard",
};

export default function ArtistBlogsPage() {
  return <ArtistBlogList />;
}
