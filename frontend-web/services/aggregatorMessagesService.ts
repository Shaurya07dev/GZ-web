import type { MessageThread } from "@/types/message";
import { mockDelay } from "@/lib/mock-utils";
import { aggregatorMessagesCol } from "@/lib/mock-collections";

// Own file, not folded into aggregatorService.ts — a distinct actor-facing
// domain (inbox, not holdings), same reasoning as messagesService.ts.
export const aggregatorMessagesService = {
  list: (): Promise<MessageThread[]> => mockDelay(aggregatorMessagesCol.get()),

  markRead: (id: string): Promise<MessageThread | undefined> => {
    const updated = aggregatorMessagesCol.get().map((message) =>
      message.id === id ? { ...message, unread: false } : message,
    );
    aggregatorMessagesCol.set(updated);
    return mockDelay(updated.find((message) => message.id === id));
  },
};
