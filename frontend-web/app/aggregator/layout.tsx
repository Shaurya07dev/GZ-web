import { AggregatorShell } from "@/features/aggregator/aggregator-shell";

// TODO(typed-routes): tighten to LayoutProps<"/aggregator"> once
// .next/dev/types/routes.d.ts has been regenerated with this route present
// (requires a `next dev` run against these files) — see Task 6's identical
// note for the auth layout. Using the plain React.ReactNode signature until
// then, per the plan's Global Constraints fallback guidance.
export default function AggregatorLayout({ children }: { children: React.ReactNode }) {
  return <AggregatorShell>{children}</AggregatorShell>;
}
