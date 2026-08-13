# GalleryZone Frontend — Customer Account + Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/account` and `/checkout` coming-soon stubs with a real (mock) Customer Account section (Orders/Wishlist/Addresses/Settings) and a real multi-step checkout flow.

**Architecture:** One Foundation task (order/address/customer types, fixtures, mock services, hooks) that both tracks below depend on, then two independent tracks in parallel: Account pages (5 tasks) and Checkout flow (1 task).

**Tech Stack:** Same as the rest of `frontend-web` — Next.js 16 App Router, TanStack Query v5, React Hook Form + Zod + `Field`/`Controller`, shadcn `base-nova`, Tailwind v4.

**Source spec:** `frontend-web/docs/superpowers/specs/2026-08-12-customer-account-checkout-design.md`.

## Global Constraints

All constraints from `docs/superpowers/plans/2026-08-11-frontend-remaining-pages.md`'s "Global Constraints" section carry over unchanged and are not repeated in full here — **read that section before starting any task in this plan.** The highlights, since they matter for every task below:

- No real backend, no automated tests — mock services with `mockDelay`/`mockError`, verify via `npx tsc --noEmit` + `eslint` + `curl` against a dev server.
- Forms use `Field`/`FieldLabel`/`FieldError` + React Hook Form `Controller` — this project's shadcn style has no real `Form` component.
- WSL: prepend `/home/yashm/.nvm/versions/node/v24.19.0/bin` to `PATH` before any npm/node command.
- Turbopack crashes in this environment compiling `app/globals.css` — always run the dev server as `node_modules/.bin/next dev --webpack -p <port>`, never bare `next dev`.
- Only one `next dev` process runs per checkout at a time — coordinate via curl against whichever port is live, or fall back to `tsc`/code-reading.
- Git commits are expected to fail with the known `.git/objects` permission error (and separately, `fatal: empty ident name` — no git identity configured). Attempt each commit step as written, note the failure, move on. Do not attempt sudo/chown/git config.
- Design craft is delegated: load `design-taste-frontend` and `emil-design-eng` before writing visual/JSX code; match the existing dark near-black + brass-gold brand system.
- All monetary values formatted via the existing `formatINR` helper in `lib/utils.ts`.

---

## Task 1: Order/customer types, mock data, services, hooks (Foundation — do this first)

**Files:**

- Create: `types/order.ts`, `types/customer.ts`
- Create: `lib/mock-data/customer.ts`
- Create: `services/customerService.ts`, `services/orderService.ts`
- Create: `hooks/useOrders.ts`, `hooks/useAddresses.ts`, `hooks/useCustomerProfile.ts`

**Interfaces:**

- Consumes: `mockDelay`, `mockError` (`lib/mock-utils.ts`), `getArtworkById` (`lib/mock-data/helpers.ts`) — all pre-existing.
- Produces: every type/fixture/service/hook listed below — both downstream tracks (Account pages, Checkout) import from here.

- [ ] **Step 1: Write the types**

`types/order.ts`:

```ts
export type OrderStatus =
  | "pending"
  | "paid"
  | "confirmed"
  | "packed"
  | "transit"
  | "delivered"
  | "cancelled";

export interface OrderStatusEvent {
  status: OrderStatus;
  changedAt: string; // ISO date
}

export interface Order {
  id: string;
  artworkId: string;
  addressId: string;
  amount: number; // artwork's customerPrice at time of purchase
  gstAmount: number;
  deliveryCharge: number;
  status: OrderStatus;
  createdAt: string; // ISO date
  statusHistory: OrderStatusEvent[];
}
```

`types/customer.ts`:

```ts
export interface Address {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string;
}
```

- [ ] **Step 2: Write `lib/mock-data/customer.ts`**

Export `mockCustomer: CustomerProfile`, `mockAddresses: Address[]` (2-3 entries, exactly one `isDefault: true`), `mockOrders: Order[]` (5-6 entries, `artworkId` referencing real ids from `mockArtworks`, `addressId` referencing real ids from `mockAddresses`). Status spread: at least one `delivered` order with a full multi-entry `statusHistory` (pending → paid → confirmed → packed → transit → delivered, each with a distinct `changedAt`), at least one still `pending` or `paid` with a short history, one `cancelled`. This is the same "give the UI real non-happy-path states to render" principle used for `mockArtworks`' reserved/sold entries.

- [ ] **Step 3: Write `services/customerService.ts`**

```ts
export const customerService = {
  getProfile: () => mockDelay(mockCustomer),
  updateProfile: (patch: Partial<CustomerProfile>) =>
    mockDelay({ ...mockCustomer, ...patch }),
  listAddresses: () => mockDelay(mockAddresses),
  addAddress: (address: Omit<Address, "id">) =>
    mockDelay({ ...address, id: crypto.randomUUID() }),
  updateAddress: (id: string, patch: Partial<Address>) =>
    mockDelay({ ...mockAddresses.find((a) => a.id === id)!, ...patch }),
  deleteAddress: (id: string) => mockDelay(undefined),
};
```

(Write the real filter/find logic — this is a sketch, not literal final code. `updateProfile`/`addAddress`/etc. don't need to actually mutate the shared `mockCustomer`/`mockAddresses` module-level arrays for correctness — the consuming components manage their own local/query-cache state after a successful mutation, same pattern as `aggregatorService.reserve` in the prior plan.)

- [ ] **Step 4: Write `services/orderService.ts`**

```ts
export const orderService = {
  list: () => mockDelay(mockOrders),
  get: (id: string) => mockDelay(mockOrders.find((o) => o.id === id)),
  create: (payload: { artworkId: string; addressId: string }) => {
    const artwork = getArtworkById(payload.artworkId);
    if (!artwork) return mockError("Artwork not found");
    const gstAmount = Math.round(artwork.customerPrice * 0.05);
    const deliveryCharge = 250; // flat mock-phase delivery charge — not specified in source docs
    const order: Order = {
      id: crypto.randomUUID(),
      artworkId: payload.artworkId,
      addressId: payload.addressId,
      amount: artwork.customerPrice,
      gstAmount,
      deliveryCharge,
      status: "pending",
      createdAt: new Date().toISOString(),
      statusHistory: [
        { status: "pending", changedAt: new Date().toISOString() },
      ],
    };
    return mockDelay(order);
  },
};
```

- [ ] **Step 5: Write the hooks**

`hooks/useOrders.ts` — `useOrders()` (`queryKey: ['orders']`), `useOrder(id)` (`queryKey: ['order', id]`), `useCreateOrderMutation()` (invalidates `['orders']` on success).
`hooks/useAddresses.ts` — `useAddresses()` (`queryKey: ['addresses']`), `useAddAddressMutation()`, `useUpdateAddressMutation()`, `useDeleteAddressMutation()` (all invalidate `['addresses']` on success).
`hooks/useCustomerProfile.ts` — `useCustomerProfile()` (`queryKey: ['customer-profile']`), `useUpdateProfileMutation()` (invalidates `['customer-profile']`).

- [ ] **Step 6: Verify**

`npx tsc --noEmit` passes. No UI yet — verified by Tasks 2-7.

- [ ] **Step 7: Commit**

```bash
git add types/order.ts types/customer.ts lib/mock-data/customer.ts services/customerService.ts services/orderService.ts hooks/useOrders.ts hooks/useAddresses.ts hooks/useCustomerProfile.ts
git commit -m "feat: add order/customer mock data layer"
```

---

## Track A: Account pages (Tasks 2-6, depend only on Task 1)

### Task 2: AccountShell + layout

**Files:**

- Create: `app/account/layout.tsx`
- Create: `features/account/account-shell.tsx`, `features/account/account-data.ts`

**Interfaces:**

- Consumes: `useCustomerProfile` (Task 1).
- Produces: shared shell wrapping every page in Tasks 3-6.

- [ ] **Step 1: Implement `AccountShell`**

Copy-and-adapt the `DashboardShell`/`AggregatorShell` structural pattern again (Sidebar + Topbar composition, same Tailwind/tokens) — a third independent shell, not a shared generalized one, same reasoning as the Aggregator track's decision. Nav items: Orders (`/account/orders`), Wishlist (`/account/wishlist`), Addresses (`/account/addresses`), Settings (`/account/settings`). Profile card shows `mockCustomer`'s name (via `useCustomerProfile`, falling back to the raw `mockCustomer` import for the very first render before the query resolves — same "start with known-good sync data, let the query refine it" pattern already used elsewhere, if that's how prior shells handled it; otherwise a brief skeleton is fine too).

- [ ] **Step 2: Implement `app/account/layout.tsx`** — one-line wrapper, same pattern as `app/dashboard/layout.tsx`/`app/aggregator/layout.tsx`.

**Important — this replaces the existing stub.** `app/account/page.tsx` currently exists as a standalone "coming soon" page (built in the original plan's Task 4) that does _not_ use this new layout. Once this layout exists, either redirect `/account` to `/account/orders` (delete the stub's content and replace with a `redirect()`) or keep a minimal `/account` landing page inside the new shell — pick whichever is less code; a redirect is simpler and there's no real need for a distinct `/account` overview separate from Orders.

- [ ] **Step 3: Verify**

Temporarily create `app/account/test/page.tsx`, run the dev server, visit `/account/test`, confirm the shell renders with correct nav/active-state. Delete the throwaway page. Visit `/account` and confirm it lands somewhere sensible (redirect or landing page, per your choice above).

- [ ] **Step 4: Commit**

```bash
git add app/account/layout.tsx features/account/account-shell.tsx features/account/account-data.ts app/account/page.tsx
git commit -m "feat: add customer account shell, replace account stub"
```

---

### Task 3: Orders list + detail

**Files:**

- Create: `app/account/orders/page.tsx`, `app/account/orders/[orderId]/page.tsx`
- Create: `features/account/order-list.tsx`, `features/account/order-status-timeline.tsx`, `features/account/order-price-breakdown.tsx`

**Interfaces:**

- Consumes: `useOrders`, `useOrder` (Task 1); `getArtworkById` (`lib/mock-data/helpers.ts`); `formatINR` (`lib/utils.ts`).
- Produces: working `/account/orders`, `/account/orders/[orderId]`.

- [ ] **Step 1: Implement `OrderList`** — one row/card per order (artwork thumbnail via `getArtworkById(order.artworkId)`, status badge, date, total), links to `/account/orders/[id]`, sorted newest first. `EmptyState` for the (currently unreachable, but correctness-matters) empty case.

- [ ] **Step 2: Implement `OrderStatusTimeline`** — takes `statusHistory: OrderStatusEvent[]`, renders the same vertical-timeline visual pattern as `features/verify/provenance-timeline.tsx` (read that file directly and reuse its structure/styling, don't reinvent).

- [ ] **Step 3: Implement `OrderPriceBreakdown`** — artist's customer price + GST + delivery charge = total, each line using `formatINR`.

- [ ] **Step 4: Assemble both pages** — list page and detail page (artwork summary + `OrderStatusTimeline` + delivery address, looked up via `order.addressId` against `useAddresses()` + `OrderPriceBreakdown`). Detail page uses `notFound()` for an unknown `orderId`.

- [ ] **Step 5: Verify**

Dev server + curl: `/account/orders` shows all seeded orders with correct statuses; `/account/orders/[a-real-id]` shows the full timeline for the `delivered` seed order and a short one for the `pending` seed order; `/account/orders/does-not-exist` 404s properly.

- [ ] **Step 6: Commit**

```bash
git add app/account/orders features/account/order-list.tsx features/account/order-status-timeline.tsx features/account/order-price-breakdown.tsx
git commit -m "feat: add order list and detail pages"
```

---

### Task 4: Wishlist page

**Files:**

- Create: `app/account/wishlist/page.tsx`

**Interfaces:**

- Consumes: `useWishlistStore` (`store/useWishlistStore.ts`); `getArtworkById`, `toSummary` (`lib/mock-data/helpers.ts`); `ArtworkCard`, `EmptyState` (`components/shared/`) — all pre-existing from the prior plan.
- Produces: working `/account/wishlist`.

- [ ] **Step 1: Implement**

Client component (needs the Zustand store). Reads `useWishlistStore().ids`, resolves each via `getArtworkById` → `toSummary`, renders a grid of `ArtworkCard`s (same grid treatment as the Marketplace page). `EmptyState` ("Nothing saved yet — browse the marketplace and tap the heart on anything you like" + a link to `/marketplace`) when `ids` is empty.

- [ ] **Step 2: Verify**

Dev server + curl for the empty-state HTML (fresh localStorage). This page's populated state can't be curl-verified (wishlist is client-side localStorage state, invisible to a fresh server-rendered request) — note that honestly rather than claiming a check that curl can't actually perform; `npx tsc --noEmit` plus a careful read of the component against `useWishlistStore`'s known shape (`{ ids: string[]; toggle(id): void; has(id): boolean }`) is the real verification here.

- [ ] **Step 3: Commit**

```bash
git add app/account/wishlist/page.tsx
git commit -m "feat: add wishlist account page"
```

---

### Task 5: Addresses page

**Files:**

- Create: `app/account/addresses/page.tsx`
- Create: `features/account/address-card.tsx`, `features/account/address-form-dialog.tsx`

**Interfaces:**

- Consumes: `useAddresses`, `useAddAddressMutation`, `useUpdateAddressMutation`, `useDeleteAddressMutation` (Task 1); `Dialog`, `Field`/`FieldLabel`/`FieldError`, `Checkbox` (`components/ui/`) — pre-existing.
- Produces: working `/account/addresses`.

- [ ] **Step 1: Implement `AddressFormDialog`**

React Hook Form + `Controller` + `Field`/`FieldLabel`/`FieldError` (per Global Constraints — not a classic shadcn `Form`), fields: line1, line2 (optional), city, state, pincode, "Set as default" `Checkbox`. Used for both add and edit (pass an optional `initialValues` prop). Small local Zod schema (line1/city/state required strings, pincode a 6-digit pattern).

- [ ] **Step 2: Implement `AddressCard`** — displays one address, Edit (opens the dialog pre-filled) and Delete buttons, a "Default" badge when `isDefault`.

- [ ] **Step 3: Assemble the page**

Grid/list of `AddressCard`s + an "Add address" button opening `AddressFormDialog` in create mode. Deleting the current default reassigns `isDefault` to another remaining address client-side if one exists (document this as a simple client-side rule in a comment, not a real backend constraint). `EmptyState` if the list is ever empty (won't be on first load, but the case should exist).

- [ ] **Step 4: Verify**

Dev server + curl for the initial server-rendered list (2-3 seeded addresses, one marked Default). Dialog open/add/edit/delete interactivity can't be curl-verified — say so plainly; `tsc`/`eslint` clean plus a careful read against the mutation hooks' known shapes is the real check here.

- [ ] **Step 5: Commit**

```bash
git add app/account/addresses features/account/address-card.tsx features/account/address-form-dialog.tsx
git commit -m "feat: add addresses account page"
```

---

### Task 6: Settings page

**Files:**

- Create: `app/account/settings/page.tsx`

**Interfaces:**

- Consumes: `useCustomerProfile`, `useUpdateProfileMutation` (Task 1); `Field`/`FieldLabel`/`FieldError` (`components/ui/field.tsx`).
- Produces: working `/account/settings`.

- [ ] **Step 1: Implement**

A single form (name/email/phone), React Hook Form + `Controller` + `Field` pattern, pre-filled from `useCustomerProfile()`, Save button calls `useUpdateProfileMutation`, success `toast`. Deliberately small — per the spec (§4), no password change, no notification toggles, nothing with no real system behind it in this mock phase.

- [ ] **Step 2: Verify**

Dev server + curl confirms the form renders pre-filled with `mockCustomer`'s seeded values. Save-and-toast interactivity can't be curl-verified — say so plainly.

- [ ] **Step 3: Commit**

```bash
git add app/account/settings/page.tsx
git commit -m "feat: add account settings page"
```

---

## Track B: Checkout flow (Task 7, depends only on Task 1)

### Task 7: Checkout flow + Buy Now link update

**Files:**

- Create: `app/checkout/page.tsx` (replaces the existing stub's content entirely)
- Create: `features/checkout/checkout-address-step.tsx`, `features/checkout/checkout-review-step.tsx`, `features/checkout/checkout-confirm-step.tsx`
- Modify: `features/marketplace/artwork-info-panel.tsx` (Buy Now link)

**Interfaces:**

- Consumes: `useAddresses`, `useAddAddressMutation` (Task 1, reuse for the inline "add new address" option); `useCreateOrderMutation` (Task 1); `getArtworkById` (`lib/mock-data/helpers.ts`); `formatINR` (`lib/utils.ts`); `Field`/`FieldLabel`/`FieldError` (`components/ui/field.tsx`).
- Produces: working `/checkout?artworkId=...`.

- [ ] **Step 1: Implement the three step components**

`CheckoutAddressStep` — radio-style selectable `mockAddresses` cards (via `useAddresses`) plus an inline "add a new address" toggle that reveals the same field set as `AddressFormDialog` (Task 5) — a lighter, non-dialog variant is fine if reusing the dialog component awkwardly wraps a wrapper; don't force it if it doesn't fit cleanly. Emits the selected/created `addressId` to the parent.

`CheckoutReviewStep` — artwork summary (thumbnail/title/artist via the `artworkId` already resolved by the page), price breakdown (customerPrice + 5% GST + ₹250 flat delivery, matching `orderService.create`'s math exactly — don't let these drift out of sync), selected address shown read-only.

`CheckoutConfirmStep` — a single "Place Order" button calling `useCreateOrderMutation({artworkId, addressId})`; on success, success state (checkmark, "Order placed", "View order" linking to `/account/orders/${newOrder.id}`); on error (network-shape errors are unlikely here since there's no simulated-conflict case specified for checkout — a plain try/catch with a toast is enough, no dev-only error toggle needed for this one).

- [ ] **Step 2: Assemble `app/checkout/page.tsx`**

`PageProps<'/checkout'>`, awaits `searchParams` for `artworkId`. If missing or `getArtworkById` returns nothing, render a small "Nothing to check out" state linking to `/marketplace` instead of a broken form. Otherwise render a 3-step client flow (local `step` state: `"address" | "review" | "confirm"`) composing the three step components, with a simple step indicator matching the visual language already established (e.g. the same numbered-step treatment feel as the landing page's journey section, without necessarily reusing that exact component).

- [ ] **Step 3: Update the Buy Now link**

In `features/marketplace/artwork-info-panel.tsx`, change the "Buy Now" button/link from `/checkout` to `` `/checkout?artworkId=${artwork.id}` ``. Read the current file first — this is a small, targeted edit to existing working code, not a rewrite.

- [ ] **Step 4: Verify**

Dev server + curl: `/checkout` (no query param) shows the "nothing to check out" state; `/checkout?artworkId=<a-real-id>` shows the address step with seeded addresses present; `/checkout?artworkId=does-not-exist` also shows the "nothing to check out" state (not a crash). Confirm `artwork-info-panel.tsx`'s Buy Now href now includes the artwork id (grep the rendered HTML for `href="/checkout?artworkId=`). Step transitions and the final order-creation mutation can't be curl-verified past the first-rendered step — say so plainly; `tsc`/`eslint` clean plus careful code reading against `orderService.create`'s known return shape is the real check for the later steps.

- [ ] **Step 5: Commit**

```bash
git add app/checkout features/checkout/ features/marketplace/artwork-info-panel.tsx
git commit -m "feat: add checkout flow, wire up Buy Now"
```

---

## Self-review notes (already applied above)

- **Spec coverage**: every section of the design spec (§2 mock identity, §3 shared data, §4 Account section incl. all four sub-pages, §5 Checkout's three steps + Buy Now update, §7 out-of-scope boundaries respected — no payment form, no cart, no notification prefs) maps to a task above.
- **Type consistency**: `Order`/`Address`/`CustomerProfile` (Task 1) are the single definitions reused verbatim through Tasks 2-7; the GST/delivery-charge math in `orderService.create` (Task 1) and `CheckoutReviewStep` (Task 7) are both pinned to the same 5%/₹250 constants so they can't silently drift apart.
- **No shared-abstraction overreach**: `AccountShell` is a third independent copy-and-adapt shell, consistent with the `DashboardShell`/`AggregatorShell` precedent, not a forced generalization.
