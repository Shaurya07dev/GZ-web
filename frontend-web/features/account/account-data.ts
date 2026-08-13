// Mirrors dashboard-data.ts's ARTIST / aggregator-data.ts's AGGREGATOR
// pattern for the sidebar profile card: there is no real customer
// auth/session in this mock phase, so lib/mock-data/customer.ts's
// mockCustomer is the single "signed in as" fixture the shell revolves
// around. Re-exported here (rather than importing the mock-data module
// directly in the shell) so every Account-track component reaches for
// identity data through one local module, same as the artist/aggregator
// shells do.
//
// Unlike ARTIST/AGGREGATOR, CustomerProfile (types/customer.ts) carries no
// avatar image field -- there's no photo to fall back to, so the profile
// card renders initials in a circle instead of an <Image>. That's the more
// honest treatment for a field that doesn't exist in the real data model,
// not a missing asset.
export { mockCustomer } from "@/lib/mock-data/customer";

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
