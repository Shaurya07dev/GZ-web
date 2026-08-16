import { mockDelay } from "@/lib/mock-utils";
import { aggregatorProfileCol } from "@/lib/mock-collections";

// Thin mirror of artistDashboardService getProfile/updateProfile, pointed at
// aggregatorProfileCol.
export const aggregatorProfileService = {
  getProfile: () => mockDelay(aggregatorProfileCol.get()),

  updateProfile: (
    patch: Partial<ReturnType<typeof aggregatorProfileCol.get>>,
  ) => {
    const updated = { ...aggregatorProfileCol.get(), ...patch };
    aggregatorProfileCol.set(updated);
    return mockDelay(updated);
  },
};
