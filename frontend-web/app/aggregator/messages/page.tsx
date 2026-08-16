import type { Metadata } from "next";
import { AggregatorMessagesInbox } from "@/features/aggregator/messages-inbox";

export const metadata: Metadata = {
  title: "Messages | GalleryZone Aggregator Portal",
};

export default function AggregatorMessagesPage() {
  return <AggregatorMessagesInbox />;
}
