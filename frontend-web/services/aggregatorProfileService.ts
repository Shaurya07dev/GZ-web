import { mockDelay, mockError } from "@/lib/mock-utils";
import { aggregatorProfileCol } from "@/lib/mock-collections";

// Thin mirror of artistDashboardService getProfile/updateProfile, pointed at
// aggregatorProfileCol.
export const aggregatorProfileService = {
  getProfile: () => mockDelay(aggregatorProfileCol.get()),

  // Signing the partner MOU records when and against which version, and is
  // never overwritten by an ordinary profile save.
  acceptMou: (input: { signatureName: string; version: string }) => {
    const profile = aggregatorProfileCol.get();
    if (!input.signatureName.trim())
      return mockError("Type your full name to sign");
    if (
      input.signatureName.trim().toLowerCase() !==
      profile.contactPerson.trim().toLowerCase()
    )
      return mockError(
        "The signature must match the contact person on your profile",
      );

    const updated = {
      ...profile,
      mouAcceptance: {
        acceptedAt: new Date().toISOString(),
        signatureName: input.signatureName.trim(),
        version: input.version,
      },
    };
    aggregatorProfileCol.set(updated);
    return mockDelay(updated);
  },

  updateProfile: (
    patch: Partial<ReturnType<typeof aggregatorProfileCol.get>>,
  ) => {
    const updated = { ...aggregatorProfileCol.get(), ...patch };
    aggregatorProfileCol.set(updated);
    return mockDelay(updated);
  },
};
