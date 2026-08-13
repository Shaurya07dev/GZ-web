import { AdminShell } from "@/features/admin/admin-shell";

// TODO(typed-routes): tighten to LayoutProps<"/admin"> once
// .next/dev/types/routes.d.ts has been regenerated with this route present
// (requires a `next dev` run against these files) -- identical to the note on
// app/aggregator/layout.tsx and the auth layout. Plain React.ReactNode until
// then, per the plan's Global Constraints fallback guidance.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
