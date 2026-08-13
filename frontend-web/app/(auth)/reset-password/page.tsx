import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password — GalleryZone",
  description: "Choose a new password for your GalleryZone account.",
};

// Missing token or the literal string "invalid" (the dev-toggle path
// described in the plan: the URL itself is the toggle, there's no separate
// UI switch on this screen) both resolve to the same expired/invalid-link
// state — a real reset flow can't tell those two failure modes apart
// either, so this mock phase shouldn't pretend to.
export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  const resolvedToken = Array.isArray(token) ? token[0] : token;

  if (!resolvedToken || resolvedToken === "invalid") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
          <XCircle className="size-6 text-destructive" strokeWidth={1.5} />
        </span>
        <AuthFormHeader
          title="This link is invalid or has expired"
          description="Reset links only work once and expire after a short time. Request a new one to continue."
        />
        <Button
          className="h-10 w-full max-w-[220px]"
          render={<Link href="/forgot-password" />}
        >
          Request a new link
        </Button>
      </div>
    );
  }

  return <ResetPasswordForm token={resolvedToken} />;
}
