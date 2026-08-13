import type { Metadata } from "next";
import { VerificationDetail } from "@/features/dashboard/verification-detail";

export const metadata: Metadata = {
  title: "Verification | GalleryZone",
};

export default function DashboardVerificationPage() {
  return <VerificationDetail />;
}
