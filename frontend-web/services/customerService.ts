import type { Address, CustomerProfile } from "@/types/customer";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { mockAddresses, mockCustomer } from "@/lib/mock-data/customer";

// Mock services never mutate the shared fixture arrays imported above —
// mutations resolve a plausible next value and the calling mutation hook's
// onSuccess (via TanStack Query cache updates) is what makes the change
// visible, exactly like aggregatorService.reserve does in the Aggregator
// track. Swapping these for real axios calls later is a same-shape change.

export const customerService = {
  getProfile: (): Promise<CustomerProfile> => mockDelay(mockCustomer),

  updateProfile: (patch: Partial<CustomerProfile>): Promise<CustomerProfile> =>
    mockDelay({ ...mockCustomer, ...patch }),

  listAddresses: (): Promise<Address[]> => mockDelay(mockAddresses),

  addAddress: (address: Omit<Address, "id">): Promise<Address> =>
    mockDelay({ ...address, id: `addr-${crypto.randomUUID()}` }),

  updateAddress: (id: string, patch: Partial<Address>): Promise<Address> => {
    const existing = mockAddresses.find((a) => a.id === id);
    if (!existing) return mockError(`Address "${id}" not found`);
    return mockDelay({ ...existing, ...patch });
  },

  deleteAddress: (id: string): Promise<{ id: string }> => {
    const existing = mockAddresses.find((a) => a.id === id);
    if (!existing) return mockError(`Address "${id}" not found`);
    return mockDelay({ id });
  },
};
