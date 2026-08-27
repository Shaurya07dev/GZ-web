import type { Metadata } from "next";
import { AggregatorMessagesInbox } from "@/features/aggregator/messages-inbox";
import { DoodleBackdrop } from "@/components/shared/doodle-backdrop";

export const metadata: Metadata = {
  title: "Messages | GalleryZone Aggregator Portal",
};

// The pattern is the page's ground, not the list's. It is absolutely
// positioned against the shell's <main>, which is the nearest positioned
// ancestor, so it fills the whole reading area — including the padding — rather
// than stopping at the edge of the message card.
export default function AggregatorMessagesPage() {
  return (
    <>
      <DoodleBackdrop />
      <div className="relative">
        <AggregatorMessagesInbox />
      </div>
    </>
  );
}
