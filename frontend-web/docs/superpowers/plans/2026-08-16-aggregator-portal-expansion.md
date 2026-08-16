# GalleryZone Aggregator Portal — Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the Aggregator Portal from its current 3 pages (`/aggregator/dashboard`, `/inventory`, `/collection`) to a complete 14-page suite matching a full business-role console — profile, sales, customers, physical gallery space, shipping, wallet, settlements, analytics, messages, support, settings — plus a grouped, collapsible sidebar nav.

**Architecture:** Three sequential Foundation tasks (types/data, service/hooks, shell rebuild), then five independent parallel page tracks.

**Tech Stack:** Same as the rest of `frontend-web` — Next.js App Router, TanStack Query v5, Zustand (only where the existing convention already uses it), React Hook Form + Zod + `Field`/`Controller`, shadcn `base-nova`, Tailwind v4, `lucide-react` icons. No new dependency needed for anything in this doc except Task 3's collapsible-group nav, which is plain React state — no library.

**Pure frontend UI, no real backend, no auth.** Mock services with `mockDelay`/`mockError` from `lib/mock-utils.ts`, consumed through TanStack Query, persisted via the `lib/mock-db.ts` + `lib/mock-collections.ts` collection pattern so actions survive a refresh and cross-page state stays consistent (reserve an artwork in Browse → it actually leaves Browse and appears in My Inventory → recording a sale actually credits the Wallet and appends a Settlement).

## Grounding — what already exists (read before starting)

This is an **expansion**, not a greenfield build. Read these first so you extend the real pattern instead of reinventing it:

- `features/aggregator/aggregator-shell.tsx` — current shell. Explicitly documented as a "parallel sibling, not shared abstraction" of `features/dashboard/dashboard-shell.tsx` (artist) and `features/admin/admin-shell.tsx`. **Keep following this convention** — do not generalize a shared `RoleShell` across three unrelated nav structures as part of this work.
- `services/aggregatorService.ts` — current service. Holdings are backed by `holdingsCol` (real persistence, shared with nothing else). Read the comments here carefully; they document real business rules (advance-percent threshold, display-price floor, the 409 reservation-race path) that new pages must stay consistent with, not invent alternatives to.
- `lib/mock-collections.ts` — the single place that seeds and wires every mock service's persisted state. All new collections in this plan get added here, following the exact `collection<T>(key, seed)` pattern already used for `holdingsCol`, `artistWalletCol`, `artistMessagesCol`, etc.
- `services/artistDashboardService.ts` + `features/dashboard/*` — the Artist Dashboard already has working, shipped equivalents of **8 of the 11 new aggregator pages** in this plan (Wallet, Settlements, Messages, Support, Settings, and a page also literally named "Gallery Spaces" — see the disambiguation note in Task 5). Every new aggregator page in Tracks C, D, and E is a copy-and-adapt of an existing artist file, not new design. The file-level mapping is given in each task.
- `frontend-web/docs/superpowers/plans/2026-08-11-frontend-remaining-pages.md`'s "Global Constraints" section — environment quirks (WSL PATH, Turbopack crash, git commit failures, verification method) apply unchanged here. Read it once; not repeated in full below.

Business-rule source documents (already read into context for this plan, referenced by section where a UI decision depends on one): `GZ_MOU_Aggregator_Context.md` (advance %, 20%-of-markup commission, 30-day custody, one-shot pricing), `MOU_Artist_Context.md` §17 (30-day aggregator display window), `markitdown/GalleryZone_Software_Architecture_Docume.md` §2.5/2.7/3.5 (DB shape + API surface this mock mirrors).

## Design decisions

### Nav: from the 16-item mockup to 14 real routes

The requested nav had two pairs of items that describe the **same underlying data** two different ways. Building separate pages/routes for both would mean two tables reading the same rows — duplicated UI with no new information. Both are folded into filters on one page instead:

| Mockup item | Resolution |
|---|---|
| Artwork Inventory | → relabel of the existing `/aggregator/collection` page (it already *is* "what's in my physical inventory right now") |
| Assigned Artworks | → a filter tab on that same page: `assignmentSource` field (new) splits rows into "Reserved by me" vs "Assigned by GalleryZone" |
| Reservations | → another filter tab on the same page: `status === "reserved"` already exists as a field: no new data needed |
| Browse GalleryZone | → relabel of the existing `/aggregator/inventory` page (it already *is* the reservable marketplace browse) |

Net: **14 routes**, not 16. Every remaining mockup item maps to exactly one route.

### Final route list, grouped

```
Main
  /aggregator/dashboard        Dashboard
  /aggregator/profile          My Profile           [NEW]
  /aggregator/inventory        Browse GalleryZone    [relabel only]
  /aggregator/collection       My Inventory          [relabel + filter tabs]

Operations
  /aggregator/orders           Orders & Sales        [NEW]
  /aggregator/customers        Customers             [NEW]
  /aggregator/gallery-spaces   Gallery Spaces        [NEW — see disambiguation below]
  /aggregator/shipping         Shipping & Logistics  [NEW]

Finance
  /aggregator/wallet           Earnings & Wallet     [NEW]
  /aggregator/settlements      Settlements           [NEW]

Growth
  /aggregator/analytics        Analytics             [NEW]
  /aggregator/messages         Messages              [NEW]

Support & Account
  /aggregator/support          Support               [NEW]
  /aggregator/settings         Settings              [NEW]
```

**Naming collision to avoid:** the Artist Dashboard already has a page titled "Gallery Spaces" (`features/dashboard/gallery-spaces-table.tsx`) — but it means something different there: it's the artist's view of *which of their own artworks are currently sitting at an aggregator's premises*. For the Aggregator Portal, "Gallery Spaces" means the opposite direction: *the aggregator's own physical premises/display locations* (`aggregator_profiles.address` + any additional display-space entries). Same label, two different actors, two different meanings — this is correct (that's genuinely what each role needs), not a bug to reconcile. Do not reuse the artist component; build a new one per Task 5.

**"Premium Aggregator" plan card:** included in the footer per the mockup, but flagged honestly — there is no `subscription_plans`-equivalent for aggregators anywhere in the SAD (§2.4's `subscription_plans`/`subscriptions` tables are Artist-domain only). This card is cosmetic/static only: a fixed plan name, a fixed expiry date, and a "Manage Plan" button that is a visual no-op (or opens a placeholder dialog saying "Plan management isn't part of this phase"). Do not wire it to any real gating logic — nothing in this plan should become unreachable behind a fake paywall.

### Collapsible nav groups — the new sidebar mechanic

Two independent collapse mechanics coexist, don't conflate them:

1. **Existing, keep unchanged:** the whole-sidebar rail-collapse (`PanelLeftClose`/`PanelLeftOpen` button, `collapsed` boolean, sidebar shrinks to icon-only width). This already works in `aggregator-shell.tsx`.
2. **New, this plan:** per-**group** expand/collapse (Main / Operations / Finance / Growth / Support & Account each individually collapsible via a chevron next to the group label), independent of #1.

Implementation (plain `useState`, no new dependency):

```ts
const NAV_GROUPS = [
  { id: "main", label: "Main", items: [...] },
  { id: "operations", label: "Operations", items: [...] },
  { id: "finance", label: "Finance", items: [...] },
  { id: "growth", label: "Growth", items: [...] },
  { id: "support", label: "Support & Account", items: [...] },
] as const;

const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

function toggleGroup(id: string) {
  setCollapsedGroups((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}

// Auto-expand whichever group contains the active route, so navigating
// straight to a URL (or clicking a link) never leaves the current page's
// own nav item hidden inside a collapsed group.
useEffect(() => {
  const activeGroup = NAV_GROUPS.find((g) =>
    g.items.some((item) => pathname.startsWith(item.href)),
  );
  if (activeGroup) {
    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup.id)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup.id);
      return next;
    });
  }
}, [pathname]);
```

Each group header is a `<button>` (group label + `ChevronDown`, rotated 180° via a `transition-transform` class when collapsed) that calls `toggleGroup(group.id)`. The `<nav>` items below render inside a wrapper whose height animates via `grid-template-rows: 0fr → 1fr` (the standard CSS-only accordion trick — no JS height measurement, no library) so the expand/collapse is animated, not a hard show/hide.

When the whole sidebar is rail-collapsed (mechanic #1), hide every group header/chevron (`collapsed && "lg:hidden"`, same pattern the current file already uses elsewhere) and render all 14 items as one flat icon list — grouping is a full-width-sidebar-only concept, matching how the existing file already hides text labels at that width.

Scope this component to `features/aggregator/aggregator-shell.tsx` only (inline, not extracted to `components/`) — same "don't generalize for one caller" reasoning the file already states for not sharing a `RoleShell`. If Admin or Artist later want grouped-collapsible nav too, extract then, with two real call sites to design against instead of guessing at the right prop shape from one.

### Account menu

Replace the current static "signed in as" footer card (non-interactive, per its own comment: *"aggregators have no verification/settings page to navigate to in this phase"* — no longer true after this plan) with a small dropdown (shadcn `DropdownMenu`, already used elsewhere in the app — check `components/shared/sign-out-button.tsx`'s call sites for the existing import pattern). Trigger = the existing avatar + company name + chevron. Menu items: **My Profile** (→ `/aggregator/profile`), **Settings** (→ `/aggregator/settings`), separator, **Sign out** (reuse the existing `SignOutButton`'s handler, don't duplicate its logic — either render it as a menu item or call the same handler it uses).

---

## Foundation (sequential — Tasks 1→3 must complete in order before any track starts)

### Task 1: Types and mock collections

**Files:**
- Modify: `types/aggregator.ts` (add `assignmentSource` to `AggregatorHolding`, add `AggregatorSale`, `GallerySpace`)
- Modify: `lib/mock-collections.ts` (add new collections, mark 2 seeded holdings as `gz_assigned`)
- Modify: `lib/mock-data/aggregator-holdings.ts` (backfill `assignmentSource` on existing fixtures — additive, don't restructure)

- [ ] **Step 1: Extend `types/aggregator.ts`**

```ts
export interface AggregatorHolding {
  id: string;
  artworkId: string;
  advancePercent: 5 | 3;
  advanceAmount: number;
  displayPrice: number;
  assignedAt: string;
  expiresAt: string;
  status: "reserved" | "sold_pending_settlement";
  // NEW — distinguishes an aggregator-initiated reservation (Browse →
  // Reserve) from GalleryZone proactively placing inventory at this
  // aggregator's premises (MOU §4: "Galleryzone may place inventory at the
  // Aggregator's premises for display"). Drives the My Inventory filter
  // tabs instead of a separate "Assigned Artworks" page/route.
  assignmentSource: "self_reserved" | "gz_assigned";
}

export interface RecordSalePayload {
  artworkId: string;
  soldPrice: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  deliveryAddress: { line1: string; city: string; state: string; pincode: string };
  deliveryMode: "courier" | "self_pickup";
}

// NEW — the persisted result of a recordSale() call. Today's recordSale()
// only flips the holding's status and discards the buyer/price/delivery
// details it's handed; this is what Orders & Sales, Customers, Shipping,
// Wallet crediting, and Settlements all need to exist as real pages instead
// of empty states. One sale per holding (enforced by recordSale in Task 2).
export interface AggregatorSale {
  id: string;
  holdingId: string;
  artworkId: string;
  soldPrice: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  deliveryAddress: { line1: string; city: string; state: string; pincode: string };
  deliveryMode: "courier" | "self_pickup";
  soldAt: string; // ISO
  shipmentStatus: "preparing" | "dispatched" | "delivered";
  dispatchedAt: string | null;
  deliveredAt: string | null;
  courierRef: string | null; // null when deliveryMode === "self_pickup"
}

// NEW — the aggregator's own physical premises. Not the same concept as the
// Artist Dashboard's "Gallery Spaces" page (which lists the artist's
// artworks currently placed at *an* aggregator) — see the plan's
// disambiguation note. One aggregator may run more than one physical
// location (MOU doesn't prohibit it), so this is an array, not a singleton.
export interface GallerySpace {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  capacity: number; // max pieces this location can display at once
  coordinatorName: string; // MOU §10: "nominate one Galleryzone coordinator"
}
```

- [ ] **Step 2: In `lib/mock-data/aggregator-holdings.ts`**, add `assignmentSource` to every existing fixture. Pick a plausible split (not all one value — the filter tab needs both to be non-empty to demo meaningfully); e.g. 2–3 of the existing holdings become `"gz_assigned"`, the rest stay `"self_reserved"`. Also add it to `DEVIKA_GALLERY_HOLDING` in `mock-collections.ts` (pick `"gz_assigned"` — it reads naturally with that fixture's existing comment).

- [ ] **Step 3: In `lib/mock-collections.ts`, add three new collections**, following the exact `collection<T>(key, seed)` pattern already used for every other entry in this file:

```ts
export const aggregatorSalesCol = collection<AggregatorSale[]>(
  "aggregatorSales",
  () => [], // starts empty; recordSale() in Task 2 populates it going forward
);

export const aggregatorGallerySpacesCol = collection<GallerySpace[]>(
  "aggregatorGallerySpaces",
  () => [
    {
      id: "space-1",
      name: "Verandah Art House — Main Gallery",
      addressLine1: "14 Church Street",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      capacity: 12,
      coordinatorName: AGGREGATOR.contactPerson, // "Meher Chatterjee" — import from features/aggregator/aggregator-data.ts
    },
  ],
);

export const aggregatorWalletCol = collection("aggregatorWallet", () => ({
  balance: 0,
  pendingBalance: 0,
  lockedBalance: 0,
}));
export const aggregatorWalletTransactionsCol = collection<WalletTransaction[]>(
  "aggregatorWalletTransactions",
  () => [],
);
export const aggregatorSettlementsCol = collection<Settlement[]>(
  "aggregatorSettlements",
  () => [],
);
export const aggregatorMessagesCol = collection<MessageThread[]>(
  "aggregatorMessages",
  () => [ /* 4–5 seed threads — see Task 6 for suggested content, grounded in
             MOU terms (audit notice, expiry reminder, damage-report ack,
             coordinator welcome) rather than generic placeholder copy,
             matching ARTIST_MESSAGE_SEED's precedent */ ],
);
export const aggregatorSupportTicketsCol = collection<SupportTicket[]>(
  "aggregatorSupportTickets",
  () => [ /* 1 seed ticket, same shape as artistSupportTicketsCol's */ ],
);
export const aggregatorSettingsCol = collection("aggregatorSettings", () => ({
  notifyNewAssignment: true,
  notifySaleRecorded: true,
  notifySettlementProcessed: true,
  notifyExpiryReminder: true, // aggregator-specific: 30-day custody window
}));
export const aggregatorProfileCol = collection("aggregatorProfile", () => ({
  companyName: AGGREGATOR.companyName,
  contactPerson: AGGREGATOR.contactPerson,
  avatar: AGGREGATOR.avatar,
  gstNumber: "29ABCDE1234F1Z5",
  phone: "+91 98450 12345",
  addressLine1: "14 Church Street, Bengaluru, Karnataka 560001",
  bankAccountMasked: "•••• •••• •••• 4821",
  ifsc: "HDFC0001234",
  securityDepositStatus: "active" as const, // MOU §7
}));
```

Wallet crediting happens in Task 2's `recordSale()`, mirroring `orderService.ts`'s `settleIntoArtistWallet()` pattern exactly (20% of `displayPrice − customerPrice`, matching the KPI math `aggregatorService.dashboardSummary()` already documents — reuse that exact formula, don't invent a second one).

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit**

```bash
git add types/aggregator.ts lib/mock-collections.ts lib/mock-data/aggregator-holdings.ts
git commit -m "feat(aggregator): add sale, gallery-space, wallet, settlement, message, support, settings, and profile mock collections"
```

---

### Task 2: Extend `aggregatorService.ts` + write new hooks

**Files:**
- Modify: `services/aggregatorService.ts`
- Create: `services/aggregatorSalesService.ts` (or extend `aggregatorService` directly — see note below)
- Create: `hooks/useAggregatorSales.ts`, `hooks/useAggregatorGallerySpaces.ts`, `hooks/useAggregatorWallet.ts`, `hooks/useAggregatorSettlements.ts`, `hooks/useAggregatorAnalytics.ts`, `hooks/useAggregatorMessages.ts`, `hooks/useAggregatorSupport.ts`, `hooks/useAggregatorSettings.ts`, `hooks/useAggregatorProfile.ts`, `hooks/useAggregatorCustomers.ts`

**Domain-split note:** `artistDashboardService.ts`'s own comment admits it's "the one track that predated" the messages/support-as-separate-files convention — `messagesService.ts` and `supportService.ts` are intentionally their **own files**, not folded into the fat per-role service, because they're a distinct actor-facing domain (inbox/tickets) reused by their same shape across roles. Follow the newer, cleaner convention here: keep `aggregatorService.ts` scoped to holdings/inventory (its current job), and add:
- `aggregatorSalesService.ts` — sales, wallet, settlements, gallery spaces, customers, shipping (all derive from `aggregatorSalesCol`/`aggregatorGallerySpacesCol`, tightly coupled to each other, one file)
- `aggregatorMessagesService.ts` and `aggregatorSupportService.ts` — thin, near-identical copies of `messagesService.ts`/`supportService.ts` pointed at the aggregator collections instead of the artist ones. (Not a shared generic service parametrized by collection — same "don't generalize for two callers when the codebase's own convention is copy-and-adapt" reasoning as the shells.)
- `aggregatorProfileService.ts` and `aggregatorSettingsService.ts` — thin, mirroring `artistDashboardService.ts`'s `getProfile`/`updateProfile`/`getSettings`/`updateSettings` shape.

- [ ] **Step 1: In `aggregatorService.ts`, rewrite `recordSale()`** to actually persist the sale instead of only flipping status:

```ts
recordSale(payload: RecordSalePayload): Promise<AggregatorHolding> {
  const holdings = holdingsCol.get();
  const index = holdings.findIndex(
    (h) => h.artworkId === payload.artworkId && h.status === "reserved",
  );
  if (index === -1) {
    return mockError("No active reservation found for this artwork");
  }
  const holding = holdings[index];
  const updated: AggregatorHolding = { ...holding, status: "sold_pending_settlement" };
  holdingsCol.set(holdings.map((h, i) => (i === index ? updated : h)));

  const now = new Date().toISOString();
  const sale: AggregatorSale = {
    id: `sale-${crypto.randomUUID().slice(0, 8)}`,
    holdingId: holding.id,
    artworkId: payload.artworkId,
    soldPrice: payload.soldPrice,
    buyerName: payload.buyerName,
    buyerEmail: payload.buyerEmail,
    buyerPhone: payload.buyerPhone,
    deliveryAddress: payload.deliveryAddress,
    deliveryMode: payload.deliveryMode,
    soldAt: now,
    shipmentStatus: "preparing",
    dispatchedAt: null,
    deliveredAt: null,
    courierRef: payload.deliveryMode === "courier" ? `CR-${Date.now().toString(36).toUpperCase()}` : null,
  };
  aggregatorSalesCol.set([sale, ...aggregatorSalesCol.get()]);

  // Credit the wallet at the same 20%-of-markup rate dashboardSummary()
  // already uses (don't recompute a second formula) — see MOU §8's
  // "Profit Share = 20% × (Listed Price − Artist Price)"; this mock has no
  // artist_price field available here, so the markup base is
  // (displayPrice − artwork.customerPrice), same substitution
  // dashboardSummary() already documents and justifies.
  const artwork = getArtworkById(payload.artworkId);
  if (artwork) {
    const commission = Math.round(0.2 * Math.max(0, holding.displayPrice - artwork.customerPrice));
    if (commission > 0) {
      const wallet = aggregatorWalletCol.get();
      aggregatorWalletCol.set({ ...wallet, pendingBalance: wallet.pendingBalance + commission });
      aggregatorWalletTransactionsCol.set([
        { id: `wt-${crypto.randomUUID().slice(0, 8)}`, type: "commission", label: `Commission: "${artwork.title}"`, amount: commission, date: now.slice(0, 10), status: "pending" },
        ...aggregatorWalletTransactionsCol.get(),
      ]);
    }
  }

  return mockDelay(updated);
},
```

- [ ] **Step 2: Write `aggregatorSalesService.ts`** — `listSales()`, `listCustomers()` (dedupe `aggregatorSalesCol` by `buyerEmail`, aggregate order count + total spend per buyer — no separate customer collection needed, derive it), `listShipments()` (same rows as `listSales()`, projected to shipment-relevant fields), `advanceShipment(saleId)` (moves `shipmentStatus` preparing → dispatched → delivered, sets the matching timestamp — a manual "advance" action since there's no real courier webhook to simulate against), `listGallerySpaces()`, `listWallet()`, `listWalletTransactions()`, `requestWithdrawal()` (mirror `artistDashboardService.requestWithdrawal`'s ₹1,000-minimum guard exactly), `listSettlements()`.

  A settlement is created when a sale's wallet commission transitions from `pending` to `processed` — model this as a **second manual action** (`processSettlement(saleId)`, e.g. a "simulate settlement" button on the Settlements page, same honesty-over-automation posture as the Admin plan's "retry" action on failed settlements) rather than an automatic timer, since there's no real payment-clearing event to trigger off in a mock. Moving to `processed` moves the wallet amount from `pendingBalance` to `balance`.

- [ ] **Step 3: Write `aggregatorMessagesService.ts` / `aggregatorSupportService.ts` / `aggregatorProfileService.ts` / `aggregatorSettingsService.ts`** — direct copies of their artist equivalents' method shapes, pointed at the new `aggregator*Col` collections from Task 1.

- [ ] **Step 4: Write the hooks** — one file per domain, exact `useQuery`/`useMutation` + `invalidateQueries` shape as `hooks/useAggregatorCollection.ts` (read it first). Query keys: `["aggregator-sales"]`, `["aggregator-customers"]`, `["aggregator-shipments"]`, `["aggregator-gallery-spaces"]`, `["aggregator-wallet"]`, `["aggregator-wallet-transactions"]`, `["aggregator-settlements"]`, `["aggregator-messages"]`, `["aggregator-support"]`, `["aggregator-settings"]`, `["aggregator-profile"]`.

  Every mutation invalidates the KPIs it affects: `recordSale` (already wired) additionally invalidates `["aggregator-wallet"]` and `["aggregator-sales"]`; `advanceShipment` invalidates `["aggregator-shipments"]`; `processSettlement` invalidates `["aggregator-settlements"]` and `["aggregator-wallet"]`.

- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean. No UI yet.
- [ ] **Step 6: Commit**

```bash
git add services/aggregator*.ts hooks/useAggregator*.ts
git commit -m "feat(aggregator): sales, gallery-space, wallet, settlement, messages, support, settings, profile services and hooks"
```

---

### Task 3: Rebuild `AggregatorShell` — grouped collapsible nav + account menu

**Files:**
- Modify: `features/aggregator/aggregator-shell.tsx`

- [ ] **Step 1:** Replace the flat `NAV_ITEMS` array with the `NAV_GROUPS` structure from the Design decisions section above (5 groups, 14 items, icons per the mapping below).
- [ ] **Step 2:** Implement `collapsedGroups` state + `toggleGroup` + the active-route auto-expand effect, exactly as specified above.
- [ ] **Step 3:** Render each group as a header button (`label` + rotating `ChevronDown`) followed by a CSS-grid accordion wrapper (`grid-rows-[0fr]`/`grid-rows-[1fr]` + `overflow-hidden` on an inner div — the zero-JS-measurement accordion pattern) containing that group's `<Link>` items, reusing the exact same per-item `<Link>` JSX/classes the current flat version already has (active-state styling, icon, collapsed-rail truncation) — don't restyle items, only restructure what wraps them.
- [ ] **Step 4:** Replace the static footer "signed in as" card with the `DropdownMenu` account menu (My Profile / Settings / separator / Sign out) per the Design decisions section.
- [ ] **Step 5:** Add the static "Premium Aggregator" plan card above the account menu, per the mockup's copy — plain plan name, fixed expiry date, no-op "Manage Plan" button/dialog. Comment marking it as cosmetic-only, per the Design decisions section's honesty note.
- [ ] **Step 6:** Update `PAGE_TITLES` (or replace with a derivation from `NAV_GROUPS` — either is fine, but every one of the 14 routes needs an entry) and the "Aggregator Portal" `Topbar` fallback title logic.

Icon mapping (all `lucide-react`, already a project dependency):

| Item | Icon |
|---|---|
| Dashboard | `LayoutGrid` (unchanged) |
| My Profile | `CircleUserRound` |
| Browse GalleryZone | `PackageSearch` (unchanged, relabel only) |
| My Inventory | `GalleryVerticalEnd` (unchanged, relabel only) |
| Orders & Sales | `ShoppingBag` |
| Customers | `Users` |
| Gallery Spaces | `Building2` |
| Shipping & Logistics | `Truck` |
| Earnings & Wallet | `Wallet` |
| Settlements | `Landmark` |
| Analytics | `LineChart` |
| Messages | `MessageSquare` |
| Support | `LifeBuoy` |
| Settings | `SettingsIcon` (`Settings as SettingsIcon`) |

- [ ] **Step 7: Verify** — `npx tsc --noEmit`, then `curl` `/aggregator/dashboard` through the running dev server and confirm all 14 links + 5 group headers render in the HTML (interactive collapse/expand state itself can't be curl-verified — state plainly what was and wasn't checked, per the Global Constraints doc).
- [ ] **Step 8: Commit**

```bash
git add features/aggregator/aggregator-shell.tsx
git commit -m "feat(aggregator): grouped collapsible sidebar nav, account menu, plan card"
```

---

## Parallel tracks (Tasks 4–8, independent once Foundation is done)

Each track creates one `app/aggregator/<route>/page.tsx` (Server Component shell, same one-line pattern as `app/aggregator/layout.tsx`) + one `features/aggregator/<name>-view.tsx` or `<name>-table.tsx` Client Component, following whichever existing file is named as its pattern source. Copy the source file's structure (loading skeleton, `EmptyState` usage, table/card layout, `PriceTag`/status-pill conventions) — these are **not** from-scratch designs.

### Task 4: My Profile (`/aggregator/profile`)

**Pattern source:** `features/dashboard/profile-kyc-form.tsx` (artist) — same `Field`/`FieldLabel`/`FieldError` + RHF form shape, but simpler (no KYC/Aadhaar section — aggregators have no `aadhaar_status` field in the SAD; that's Artist-domain only).

Fields (from `aggregatorProfileCol`, Task 1): company name, contact person, GST number, phone, address, bank account (masked) + IFSC (editable, mirror `artistDashboardService.updateBankDetails`'s masking pattern exactly), and a read-only "Security deposit: Active" indicator (MOU §7 — display only, no UI to change it; that's an admin action, out of scope here same as the Admin plan keeps Aadhaar-approval admin-only).

- [ ] Build `app/aggregator/profile/page.tsx` + `features/aggregator/profile-form.tsx`, wired to `useAggregatorProfile`.
- [ ] Verify + commit (`git commit -m "feat(aggregator): My Profile page"`).

### Task 5: Orders & Sales, Customers, Gallery Spaces, Shipping & Logistics

**Pattern sources:** `features/dashboard/orders-table.tsx` (table shape), `features/aggregator/record-sale-dialog.tsx` (already captures every field these pages display — no new form needed).

- [ ] **`/aggregator/orders`** — `features/aggregator/sales-table.tsx`, wired to `useAggregatorSales()`. Columns: artwork, buyer, sold price, commission earned (20% of markup, same formula as Task 2), sold date, shipment status pill. Row click → expand/drawer with full buyer + delivery detail (reuse the `RecordSaleDialog`'s field list as the read-only display shape).
- [ ] **`/aggregator/customers`** — `features/aggregator/customers-table.tsx`, wired to `useAggregatorCustomers()` (deduped-by-email view over the same sales data — no separate collection, see Task 2 Step 2). Columns: name, email, phone, orders count, total spend.
- [ ] **`/aggregator/gallery-spaces`** — `features/aggregator/gallery-spaces-board.tsx` (deliberately different filename than the artist's `gallery-spaces-table.tsx` to avoid implying they're related), wired to `useAggregatorGallerySpaces()`. Card-per-location layout (not a table — one seeded location per Task 1, this page should look reasonable at both 1 and N locations): name, address, coordinator, capacity, and **current occupancy** (count of active `holdingsCol` rows — cross-reference, doesn't need its own field).
- [ ] **`/aggregator/shipping`** — `features/aggregator/shipping-table.tsx`, wired to `useAggregatorShipments()`. Two sections: **Inbound** (artworks in transit from GalleryZone to this aggregator — derive from `holdingsCol` rows whose `expiresAt` is far enough in the future to still be "recently assigned"; or simpler, keep this section a static/seeded illustrative list since the SAD doesn't model an inbound-transit status distinct from "reserved" — note this honestly as a simplification rather than forcing a fake state machine) and **Outbound** (post-sale shipments — real, from `aggregatorSalesCol`, with the `advanceShipment` mutation from Task 2 as a "Mark dispatched" / "Mark delivered" action per row).
- [ ] Verify + commit each page independently (4 commits, or 1 combined — track owner's call, matching the Admin plan's precedent of grouping tightly related pages into one task/commit when they share one data source).

### Task 6: Earnings & Wallet, Settlements

**Pattern sources:** `features/dashboard/wallet-overview.tsx`, `features/dashboard/settlements-table.tsx` — copy structure directly, these are close to 1:1 reusable layouts with different data.

- [ ] **`/aggregator/wallet`** — `features/aggregator/wallet-overview.tsx`, wired to `useAggregatorWallet()` + `useAggregatorWalletTransactions()`. Balance / pending / locked tiles, transaction list, withdraw-request dialog (₹1,000 minimum, mirror `artistDashboardService.requestWithdrawal` exactly).
- [ ] **`/aggregator/settlements`** — `features/aggregator/settlements-table.tsx`, wired to `useAggregatorSettlements()`. Same `Settlement` type as the artist page and Admin's settlement table (`types/admin.ts` — already has `aggregatorCommission` as a first-class field, this is the one settlements table across the whole app where that field is actually the primary number, not a zero). Add the "Simulate settlement" action from Task 2 Step 2 on `pending` rows.
- [ ] Verify + commit.

### Task 7: Analytics, Messages

**Pattern sources:** `features/dashboard/artist-analytics-view.tsx`, `features/dashboard/messages-inbox.tsx` — copy structure, swap data source.

- [ ] **`/aggregator/analytics`** — `features/aggregator/analytics-view.tsx`. Pre-baked demo series (same "explicitly not derived from thin fixture data" posture as the Admin plan's analytics — a handful of real holdings/sales rows can't produce a believable 12-month trend line, don't pretend otherwise): sell-through rate, average display markup over the customer-price floor, commission earned over time, and a top-categories-moved breakdown. Label as demonstration data in-code, same as `lib/mock-data/admin-analytics.ts` does.
- [ ] **`/aggregator/messages`** — `features/aggregator/messages-inbox.tsx` (own file — don't reuse the artist one, it's tied to `useArtistMessages`), wired to `useAggregatorMessages()`. Seed 4–5 threads grounded in real MOU terms: a GalleryZone-coordinator welcome, a 30-day-expiry reminder for one specific holding, a damage-report acknowledgment, an audit-visit notice (MOU §4: "permit audits").
- [ ] Verify + commit.

### Task 8: Support, Settings

**Pattern sources:** `features/dashboard/support-view.tsx`, `features/dashboard/artist-settings-view.tsx` — copy structure, swap data source.

- [ ] **`/aggregator/support`** — `features/aggregator/support-view.tsx`, wired to `useAggregatorSupport()`. Ticket list + "submit a ticket" form, same validation as `supportService.submitTicket` (non-empty subject/message).
- [ ] **`/aggregator/settings`** — `features/aggregator/settings-view.tsx`, wired to `useAggregatorSettings()`. Notification toggles from Task 1's `aggregatorSettingsCol` shape (new assignment, sale recorded, settlement processed, expiry reminder).
- [ ] Verify + commit.

---

## Verification approach

Same as every prior phase in this codebase: no automated test suite, no browser/screenshot tool assumed available. `npx tsc --noEmit`, `eslint`, and `curl` against a `--webpack` dev server (never bare `next dev` — Turbopack crashes on this project's `globals.css`) checking status codes and rendered body content for every new route. Interactive state (collapsed nav groups, dropdown menus, dialog forms, mutation-driven table updates) is client-rendered and **cannot** be curl-verified past the loading skeleton — state this plainly in task reports rather than implying full coverage. If a real browser is available in your environment, exercise at minimum: reserve → confirm it leaves Browse and appears in My Inventory → record a sale → confirm it appears in Orders & Sales, credits the Wallet's pending balance, and shows up as a Customer row.

## Explicitly out of scope

- Real backend, real auth, real payment/courier integration.
- A real subscription/plan system for aggregators — the "Premium Aggregator" footer card is cosmetic only (see Design decisions).
- Row virtualization, bulk actions — same reasoning as the Admin plan (§7/§9 of that spec): fixture-sized datasets, and per-item review/action flows are the point.
- A second physical "inbound transit" state machine beyond what `AggregatorHolding.status` already models — the Shipping page's inbound section is illustrative, noted as such in Task 5.
- Editing the security deposit or aggregator status (`active`/etc.) from the Aggregator Portal itself — that's an admin action (`/admin/aggregators/[id]`), out of scope for this actor's own console, same separation of concern the Admin plan already draws for KYC/withdrawal approval.
- Multi-tenant / multiple simultaneous aggregator identities — same single hardcoded actor convention as `ARTIST`/`ADMIN` (`AGGREGATOR` constant, unauthenticated mock phase).
