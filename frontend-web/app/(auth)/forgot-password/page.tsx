import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password — GalleryZone",
  description: "Reset the password for your GalleryZone account.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
