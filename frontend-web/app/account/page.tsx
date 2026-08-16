import type { Metadata } from "next";
import { CollectorDashboard } from "@/features/account/collector-dashboard";

export const metadata: Metadata = {
  title: "Dashboard | GalleryZone",
};

export default function AccountPage() {
  return <CollectorDashboard />;
}
