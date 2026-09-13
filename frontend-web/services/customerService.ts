import type { Address, CustomerProfile } from "@/types/customer";
import { mockDelay } from "@/lib/mock-utils";
import { customerProfileCol } from "@/lib/mock-collections";
import { http } from "@/lib/api";
import { toAddress, type AddressDto } from "@/lib/api-mappers";

// Addresses are real (GET/POST/PATCH/DELETE /v1/account/addresses) because
// checkout needs a real addressId. The profile (name/phone/GSTIN/bank
// details) still reads the mock collection — the backend has no customer
// profile write route yet.

export const customerService = {
  getProfile: (): Promise<CustomerProfile> => mockDelay(customerProfileCol.get()),

  updateProfile: (patch: Partial<CustomerProfile>): Promise<CustomerProfile> => {
    const updated = { ...customerProfileCol.get(), ...patch };
    customerProfileCol.set(updated);
    return mockDelay(updated);
  },

  listAddresses: async (): Promise<Address[]> => {
    const rows = await http.get<AddressDto[]>("/v1/account/addresses");
    return rows.map(toAddress);
  },

  addAddress: async (address: Omit<Address, "id">): Promise<Address> => {
    const { id } = await http.post<{ id: string }>("/v1/account/addresses", {
      line1: address.line1,
      line2: address.line2 || undefined,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: address.isDefault,
    });
    return { ...address, id };
  },

  updateAddress: async (id: string, patch: Partial<Address>): Promise<Address> => {
    await http.patch(`/v1/account/addresses/${encodeURIComponent(id)}`, {
      ...(patch.line1 !== undefined && { line1: patch.line1 }),
      ...(patch.line2 !== undefined && { line2: patch.line2 || undefined }),
      ...(patch.city !== undefined && { city: patch.city }),
      ...(patch.state !== undefined && { state: patch.state }),
      ...(patch.pincode !== undefined && { pincode: patch.pincode }),
      ...(patch.isDefault !== undefined && { isDefault: patch.isDefault }),
    });
    const rows = await http.get<AddressDto[]>("/v1/account/addresses");
    const updated = rows.find((r) => r.id === id);
    if (!updated) throw new Error(`Address "${id}" not found`);
    return toAddress(updated);
  },

  deleteAddress: async (id: string): Promise<{ id: string }> => {
    await http.delete(`/v1/account/addresses/${encodeURIComponent(id)}`);
    return { id };
  },
};
