import type { Metadata } from "next";
import { VerifyEmailStatus } from "@/features/auth/components/verify-email-status";

export const metadata: Metadata = {
  title: "Verify Email | GalleryZone",
  description: "Verifying your GalleryZone account email address.",
};

export default async function VerifyEmailPage(
  props: PageProps<"/verify-email">,
) {
  const { token } = await props.searchParams;
  const resolvedToken = Array.isArray(token) ? token[0] : token;

  return <VerifyEmailStatus token={resolvedToken} />;
}
