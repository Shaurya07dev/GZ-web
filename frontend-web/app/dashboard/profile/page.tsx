import type { Metadata } from "next";
import { ProfileKycForm } from "@/features/dashboard/profile-kyc-form";

export const metadata: Metadata = {
  title: "Profile & KYC | GalleryZone",
};

export default function DashboardProfilePage() {
  return <ProfileKycForm />;
}
