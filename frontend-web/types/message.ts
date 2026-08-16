export interface MessageThread {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  unread: boolean;
  receivedAt: string; // ISO
}
