import type { Address, CustomerProfile } from "@/types/customer";
import { mockDelay, mockError } from "@/lib/mock-utils";
import { addressesCol, customerProfileCol } from "@/lib/mock-collections";

export const customerService = {
  getProfile: (): Promise<CustomerProfile> => mockDelay(customerProfileCol.get()),

  updateProfile: (patch: Partial<CustomerProfile>): Promise<CustomerProfile> => {
    const updated = { ...customerProfileCol.get(), ...patch };
    customerProfileCol.set(updated);
    return mockDelay(updated);
  },

  listAddresses: (): Promise<Address[]> => mockDelay(addressesCol.get()),

  addAddress: (address: Omit<Address, "id">): Promise<Address> => {
    const created: Address = { ...address, id: `addr-${crypto.randomUUID()}` };
    addressesCol.set([...addressesCol.get(), created]);
    return mockDelay(created);
  },

  updateAddress: (id: string, patch: Partial<Address>): Promise<Address> => {
    const addresses = addressesCol.get();
    const existing = addresses.find((a) => a.id === id);
    if (!existing) return mockError(`Address "${id}" not found`);
    const updated = { ...existing, ...patch };
    addressesCol.set(addresses.map((a) => (a.id === id ? updated : a)));
    return mockDelay(updated);
  },

  deleteAddress: (id: string): Promise<{ id: string }> => {
    const addresses = addressesCol.get();
    const existing = addresses.find((a) => a.id === id);
    if (!existing) return mockError(`Address "${id}" not found`);
    addressesCol.set(addresses.filter((a) => a.id !== id));
    return mockDelay({ id });
  },
};
