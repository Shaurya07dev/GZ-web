import { MessagesInbox } from "@/features/dashboard/messages-inbox";
import { DoodleBackdrop } from "@/components/shared/doodle-backdrop";

export const metadata = {
  title: "Messages | GalleryZone Artist Dashboard",
};

export default function ArtistMessagesPage() {
  return (
    <>
      <DoodleBackdrop />
      <div className="relative space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Messages
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Updates from GalleryZone about your submissions, sales, and account.
          </p>
        </div>
        <MessagesInbox />
      </div>
    </>
  );
}
