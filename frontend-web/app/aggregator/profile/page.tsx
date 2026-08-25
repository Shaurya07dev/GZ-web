import type { Metadata } from "next";
import { ProfileForm } from "@/features/aggregator/profile-form";
import { AggregatorMouAgreement } from "@/features/aggregator/aggregator-mou";
import { AggregatorProfileSummary } from "@/features/aggregator/aggregator-profile-summary";

export const metadata: Metadata = {
  title: "My Profile | GalleryZone Aggregator Portal",
};

export default function AggregatorProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      {/* The business at a glance before the form that edits it. */}
      <AggregatorProfileSummary />
      <AggregatorMouAgreement />
      <ProfileForm />
    </div>
  );
}
