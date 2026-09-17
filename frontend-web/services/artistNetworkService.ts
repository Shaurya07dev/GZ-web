import type { ArtistConnection } from "@/types/artist-network";

// Artist-to-artist connections have no API yet. Every read is empty and
// every write refuses, so the panel shows an honest empty state instead of
// a fixture network.
export const artistNetworkService = {
  listConnections: async (_artistId: string): Promise<ArtistConnection[]> => [],
  getConnectionWith: async (_a: string, _b: string): Promise<ArtistConnection | null> => null,
  sendConnectionRequest: async (_input: { requesterId: string; recipientId: string; message?: string }): Promise<ArtistConnection> => {
    throw new Error("Artist connections are coming soon.");
  },
  respondToConnection: async (_input: { connectionId: string; viewerId: string; accept: boolean }): Promise<ArtistConnection> => {
    throw new Error("Artist connections are coming soon.");
  },
};
