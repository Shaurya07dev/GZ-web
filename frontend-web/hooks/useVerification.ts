import { notify } from "@/lib/notify";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isUnavailable, verificationService } from "@/services/verificationService";

// GSTIN and Aadhaar verification, for the artist's own Profile & KYC screen.
//
// Both mutations are deliberately careful about the difference between "the
// registry said no" and "we could not ask". The second is our own
// misconfiguration and must never be reported as a verdict about the artist,
// so every error path checks isUnavailable() first.

/**
 * Check the saved GSTIN against the GST registry.
 *
 * A pass moves the status to "submitted", not "approved" — the admin queue
 * still decides, because the GST flag drives invoicing and the §194-O TDS
 * threshold. The success copy says so rather than claiming the GSTIN is
 * approved, so the profile refetches to show the new badge.
 */
export function useVerifyGstinMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => verificationService.verifyGstin(),
    onError: (error) => {
      if (isUnavailable(error)) {
        notify.error("GSTIN check unavailable")(
          new Error("We couldn't reach the GST registry just now. Your GSTIN is saved — try the check again in a few minutes."),
        );
        return;
      }
      notify.error("GSTIN check failed")(error);
    },
    onSuccess: (result) => {
      if (result.valid) {
        notify.success(
          "GSTIN found in the GST registry",
          result.legalName ? `Registered to ${result.legalName}. An admin will confirm it against your account.` : "An admin will confirm it against your account.",
        );
      } else {
        // The registry answered, and the answer was no. This IS a verdict, so
        // it is said plainly — and the registry's own wording is shown rather
        // than a guess at why.
        notify.error("GSTIN not found")(new Error(result.message ?? "The GST registry has no active registration for this GSTIN. Check it for typos."));
      }
      queryClient.invalidateQueries({ queryKey: ["artist-account-profile"] });
    },
  });
}

/**
 * Open a DigiLocker consent session and send the artist to it.
 *
 * The outcome never comes back through this call — it arrives on the Secure ID
 * webhook once the artist has consented on DigiLocker's own site, which is why
 * the Aadhaar number itself never reaches GalleryZone. The consent URL is
 * valid for about ten minutes, so the redirect happens immediately.
 */
export function useStartAadhaarVerificationMutation() {
  return useMutation({
    mutationFn: () => verificationService.startAadhaarDigiLocker(),
    onError: (error) => {
      if (isUnavailable(error)) {
        notify.error("Aadhaar verification unavailable")(new Error("We couldn't start Aadhaar verification just now. Please try again in a few minutes."));
        return;
      }
      notify.error("Aadhaar verification could not start")(error);
    },
    onSuccess: ({ consentUrl }) => {
      // Same tab, not a popup: this is a consent handoff to DigiLocker and it
      // returns to the profile page afterwards, so a blocked popup must not be
      // able to strand the flow.
      window.location.assign(consentUrl);
    },
  });
}
