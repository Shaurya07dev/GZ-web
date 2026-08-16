import { mockDelay } from "@/lib/mock-utils";
import { aggregatorSettingsCol } from "@/lib/mock-collections";

// Thin mirror of artistDashboardService getSettings/updateSettings, pointed at
// aggregatorSettingsCol.
export const aggregatorSettingsService = {
  getSettings: () => mockDelay(aggregatorSettingsCol.get()),

  updateSettings: (
    patch: Partial<ReturnType<typeof aggregatorSettingsCol.get>>,
  ) => {
    const updated = { ...aggregatorSettingsCol.get(), ...patch };
    aggregatorSettingsCol.set(updated);
    return mockDelay(updated);
  },
};
