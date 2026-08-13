import { AccountShell } from "@/features/account/account-shell";

// TODO(typed-routes): tighten to LayoutProps<"/account"> once
// .next/dev/types/routes.d.ts has been regenerated with this route present
// (requires a `next dev` run against these files) -- see the Aggregator
// track's identical note in app/aggregator/layout.tsx.
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountShell>{children}</AccountShell>;
}
