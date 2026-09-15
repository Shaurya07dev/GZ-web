import type { MessageThread } from "@/types/message";
import { supportApi } from "./supportApi";

// Inbox on the API, scoped to the signed-in account.
export const aggregatorMessagesService = {
  list: (): Promise<MessageThread[]> => supportApi.listMessages(),

  markRead: (id: string): Promise<MessageThread | undefined> => supportApi.markRead(id),
};
