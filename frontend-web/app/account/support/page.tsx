import type { Metadata } from "next";
import { CollectorSupportView } from "@/features/account/support-view";
import { DoodleBackdrop } from "@/components/shared/doodle-backdrop";

export const metadata: Metadata = {
  title: "Support | GalleryZone",
};

export default function AccountSupportPage() {
  return (
    <>
      <DoodleBackdrop />
      <div className="relative flex flex-col gap-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Support
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Answers to common questions, or reach GalleryZone directly.
          </p>
        </div>

        <CollectorSupportView />
      </div>
    </>
  );
}
