import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/register-form";
import { roleSchema } from "@/features/auth/schemas/auth-schemas";

export const metadata: Metadata = {
  title: "Create your account — GalleryZone",
  description:
    "Join GalleryZone as an artist, aggregator, or collector of verified original artwork.",
};

// /register?role=artist is already linked live from the shipped SiteHeader
// ("Become an Early Artist") and SiteFooter ("Join GalleryZone", "Early
// Artist Program") — this query param is required, not optional. Anything
// that doesn't parse as a valid Role (missing, malformed, or an array from
// a repeated query key) safely falls through to `undefined`, which
// RegisterForm treats as "start on the role-picker step".
export default async function RegisterPage(props: PageProps<"/register">) {
  const { role } = await props.searchParams;
  const parsedRole = roleSchema.safeParse(role);

  return (
    <RegisterForm initialRole={parsedRole.success ? parsedRole.data : undefined} />
  );
}
