import { http } from "@/lib/api";

// Admin broadcasts (backend: broadcasts.controller.ts): one message to every artist, every aggregator, or both.
// It lands in each person's Messages inbox and bell.

export type BroadcastAudience = "artist" | "aggregator";

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  audiences: BroadcastAudience[];
  url: string | null;
  sentByName: string;
  sentAt: string;
  recipientCount: number;
}

export interface BroadcastInput {
  audiences: BroadcastAudience[];
  title: string;
  body: string;
  /** A page on this site, like "/dashboard/coa-nfc". Optional. */
  url?: string | null;
}

export const BROADCAST_TITLE_MAX = 80;
export const BROADCAST_BODY_MAX = 2000;

export const broadcastService = {
  reach: () => http.get<Record<BroadcastAudience, number>>("/v1/admin/broadcasts/reach"),

  list: async (): Promise<Broadcast[]> => (await http.get<{ broadcasts: Broadcast[] }>("/v1/admin/broadcasts")).broadcasts,

  send: (input: BroadcastInput) => http.post<{ id: string; recipientCount: number }>("/v1/admin/broadcasts", input),
};
