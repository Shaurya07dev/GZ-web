import type { Metadata } from "next";
import { CollectorSupportView } from "@/features/account/support-view";

export const metadata: Metadata = {
  title: "Support | GalleryZone",
};

export default function AccountSupportPage() {
  return (
    <div className="flex flex-col gap-6">
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
  );
}
