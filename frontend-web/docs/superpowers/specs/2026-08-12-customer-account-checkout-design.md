# GalleryZone Frontend — Customer Account + Checkout

Status: Approved for planning
Date: 2026-08-12
Scope owner: frontend-web (Next.js 16/React 19 App Router)

## 1. Purpose

This is a follow-on to `2026-08-11-frontend-remaining-pages-design.md`, which
explicitly scoped Customer Account and Checkout **out** (§11 of that spec).
This spec covers building them now: the Orders/Wishlist/Addresses/Settings
account section and a real (mock) multi-step checkout flow, replacing the
`/account` and `/checkout` coming-soon stubs built earlier.

Same constraint as before: **pure frontend UI, no real backend.** Everything
follows the same mock-service-layer pattern established in the prior spec's
§2 — service functions resolve fixture data after a fake delay through
`useQuery`/`useMutation`, exactly like every other track already built.

Reference: SAD `orders`/`order_items`/`delivery`/`customer_addresses` table
definitions (Ch. 2 §2.5, §2.8) for realistic field shapes; the Onboarding
Guide's pricing worked example for the price/GST/delivery breakdown shown at
checkout.

## 2. The missing piece: a mock customer identity

No part of this app has a real logged-in session anywhere — Login's role
toggle only decides a redirect target. The Artist Dashboard and Aggregator
Portal both work around this with a single hardcoded identity constant
(`ARTIST` in `dashboard-data.ts`, `AGGREGATOR` in `aggregator-data.ts`). This
spec does the same: a single hardcoded `mockCustomer` (name, email, phone)
that every Account page and the Checkout flow revolves around, seeded with a
handful of past orders and 2-3 saved addresses so the UI has real,
non-empty states to render on first visit.

## 3. Shared data additions

- `types/order.ts` — `OrderStatus` (`pending | paid | confirmed | packed |
transit | delivered | cancelled`, per SAD `orders` table), `Order`
  (id, artworkId, amount, gstAmount, deliveryCharge, status, createdAt,
  addressId, statusHistory: `{status, changedAt}[]`).
- `types/customer.ts` — `Address` (id, line1, line2?, city, state, pincode,
  isDefault), `CustomerProfile` (name, email, phone).
- `lib/mock-data/customer.ts` — `mockCustomer: CustomerProfile`,
  `mockAddresses: Address[]` (2-3 seeded, one `isDefault: true`),
  `mockOrders: Order[]` (5-6 seeded, referencing real `mockArtworks` ids,
  spanning at least 3 different statuses including one `delivered` with a
  full status history and one `pending`/`paid` still in flight — so the
  Orders list and an order detail page both have real variety to show).
- `services/customerService.ts` — `getProfile`, `updateProfile`,
  `listAddresses`, `addAddress`, `updateAddress`, `deleteAddress`.
- `services/orderService.ts` — `listOrders`, `getOrder`, `createOrder(payload)`
  (the checkout confirm action — appends a new `Order` with `status:
"pending"` and a one-entry status history, floor-level realistic, not
  actually processing payment).
- Corresponding `hooks/useOrders.ts`, `hooks/useAddresses.ts`,
  `hooks/useCustomerProfile.ts` (query-key convention matching SAD §5.4:
  `['orders']`, `['order', id]`, `['addresses']`, `['customer-profile']`;
  mutations invalidate the relevant list key on success, exactly like every
  other mutation already built in this app).

## 4. Account section (`/account/*`)

New `AccountShell` (`features/account/account-shell.tsx` +
`app/account/layout.tsx`) — copy-and-adapt the `DashboardShell`/
`AggregatorShell` pattern again (same reasoning as before: don't generalize
a shared `RoleShell` for a third use case, keep each shell independently
understandable). Nav: Orders, Wishlist, Addresses, Settings. Profile card
shows `mockCustomer`'s name.

- **`/account/orders`** — list of `mockOrders`, status badge per row
  (reuse/extend the status-badge pattern already established on
  `ArtworkCard`), sorted newest first, `EmptyState` if empty (won't be, but
  the pattern should still exist for correctness).
- **`/account/orders/[orderId]`** — order detail: artwork summary
  (thumbnail/title/artist, reusing existing display components), a status
  timeline (directly reuse the `ProvenanceTimeline` visual pattern already
  built for the Verify page — same "vertical timeline of status + date"
  shape, different data source), delivery address, price breakdown
  (artist's markup-inclusive price + GST + delivery charge = total, using
  the existing `formatINR`/`PriceTag`).
- **`/account/wishlist`** — grid of `ArtworkCard`s for every id in
  `useWishlistStore().ids`, resolved via `getArtworkById` (Task 2 of the
  prior plan) → `toSummary`. `EmptyState` ("Nothing saved yet" + a link to
  `/marketplace`) when the wishlist is empty — this one will actually be
  empty on first visit for most people, so the empty state matters.
- **`/account/addresses`** — list of `mockAddresses` as cards, "Add
  address" opens a `Dialog` with a form (line1/line2/city/state/pincode +
  "set as default" checkbox), matching the `Field`/`Controller` pattern
  used everywhere else forms exist in this app (Auth, Aggregator's Record
  Sale). Edit/delete per address. Deleting the current default reassigns
  default to another address if one exists (simple client-side rule,
  document it in the code, not a real backend constraint).
- **`/account/settings`** — a single form (name/email/phone) pre-filled
  from `mockCustomer`, save button updates the mock profile via
  `updateProfile` mutation. No password change (there's no real auth to
  change a password against) and no notification-preferences toggles —
  keep this page small and honest about what it can plausibly do in a
  mock-only app, rather than padding it with UI that has nothing behind it.

## 5. Checkout flow (`/checkout`)

Reads `artworkId` from the query string (`/checkout?artworkId=...`, same
pattern already established by `/register?role=...`). If missing or the
artwork doesn't resolve via `getArtworkById`, render a small "Nothing to
check out — browse the marketplace" state linking to `/marketplace` rather
than crashing or showing a blank form.

Three steps, single page, client-side step state (no need for separate
routes per step — this mirrors how Register's role-picker-then-form already
works as one page with an internal step transition):

1. **Address** — pick one of `mockAddresses` (radio-style cards) or add a
   new one inline (reuses the same address form fields as the Addresses
   page, but doesn't have to reuse the exact same component if that's
   awkward — a lighter inline variant is fine).
2. **Review** — artwork summary, price breakdown (`customerPrice` + 5% GST
   - a flat delivery charge — pick a realistic flat value, e.g. ₹250, and
     say so plainly in the code as a mock-phase simplification, since the
     real delivery-charge calculation isn't specified anywhere in the source
     docs), selected address shown for confirmation.
3. **Confirm** — a button that calls `createOrder`, then shows a success
   state (checkmark, order number, "View order" linking to
   `/account/orders/[newOrderId]`) — no fake payment form, no card-number
   theater; per platform rules the customer pays inclusive of GST/delivery
   at this step and there's nothing further to simulate.

**Buy Now update**: `ArtworkInfoPanel` (built in the prior track, in
`features/marketplace/artwork-info-panel.tsx`) currently links its "Buy
Now" button to the bare `/checkout` stub — update it to
`/checkout?artworkId=${artwork.id}`. This is a one-line edit to an existing
file, not a new file.

## 6. Verification approach

Same as the rest of this project: no automated test suite, no browser tool
available in this environment. Verify via `npx tsc --noEmit`, `eslint`, and
`curl` against a `--webpack` dev server checking status codes and rendered
body content for every new route and the updated Buy Now link.

## 7. Explicitly out of scope

- Real payment processing of any kind (no card form, no payment gateway
  integration — mock-confirmed only, matching the "no backend" constraint).
- Order cancellation/return flows (SAD lists `returned` etc. as possible
  artwork statuses but building the UI to _trigger_ those transitions from
  the customer side is not part of this pass).
- Notification preferences, password change, or any other Settings-page
  feature with nothing real behind it in this mock phase.
- Multi-item cart / multi-artwork orders — the SAD itself notes `order_items`
  exists for future multi-item support but v1 is one artwork per order; this
  build matches that constraint exactly, no cart concept is introduced.
