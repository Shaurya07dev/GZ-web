import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Sign In | GalleryZone",
  description: "Sign in to your GalleryZone account.",
};

export default function LoginPage() {
  return <LoginForm />;
}
