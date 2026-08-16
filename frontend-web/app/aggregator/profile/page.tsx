import type { Metadata } from "next";
import { ProfileForm } from "@/features/aggregator/profile-form";

export const metadata: Metadata = {
  title: "My Profile | GalleryZone Aggregator Portal",
};

export default function AggregatorProfilePage() {
  return <ProfileForm />;
}
