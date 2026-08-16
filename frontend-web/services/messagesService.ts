import type { MessageThread } from "@/types/message";
import { mockDelay } from "@/lib/mock-utils";
import { artistMessagesCol } from "@/lib/mock-collections";

// Own file, not folded into artistDashboardService.ts — a distinct
// actor-facing domain (inbox, not account data), same reasoning as
// aggregatorService.ts staying separate from artistDashboardService.ts.
export const messagesService = {
  list: (): Promise<MessageThread[]> => mockDelay(artistMessagesCol.get()),

  markRead: (id: string): Promise<MessageThread | undefined> => {
    const updated = artistMessagesCol.get().map((message) =>
      message.id === id ? { ...message, unread: false } : message,
    );
    artistMessagesCol.set(updated);
    return mockDelay(updated.find((message) => message.id === id));
  },
};
