import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingVerify } from "@/features/auth/components/onboarding-verify";

export const metadata: Metadata = {
  title: "Confirm your email and phone | GalleryZone",
  description:
    "Enter the six-digit codes we sent you to finish setting up your GalleryZone account.",
};

/**
 * /onboarding/verify
 *
 * The two-step verification screen that follows email+password sign-up and
 * Google sign-up. See `OnboardingVerify` for the behaviour. The page is
 * deliberately thin so refresh / back / share-link all work.
 */
export default function OnboardingVerifyPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingVerify />
    </Suspense>
  );
}
