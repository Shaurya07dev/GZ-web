# GalleryZone Admin Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Admin Dashboard at `app/admin/*` — overview, deep analytics, three approval workflows (artwork moderation, KYC, withdrawals), catalog/people/commerce management tables, and system pages (audit logs, reports, settings).

**Architecture:** Four sequential Foundation tasks (data, services, shell/table, charts) that everything depends on, then four independent parallel tracks.

**Tech Stack:** Same as the rest of `frontend-web` — Next.js 16 App Router, TanStack Query v5, Zustand, React Hook Form + Zod + `Field`/`Controller`, shadcn `base-nova`, Tailwind v4 — **plus Recharts** (new, admin-only).

**Source spec:** `frontend-web/docs/superpowers/specs/2026-08-12-admin-dashboard-design.md` — read it before starting; it explains the *why* behind decisions this plan only states.

## Global Constraints

All constraints from `docs/superpowers/plans/2026-08-11-frontend-remaining-pages.md`'s "Global Constraints" section carry over unchanged — **read that section before starting any task here.** Highlights that matter most:

- **No real backend, no automated tests.** Mock services with `mockDelay`/`mockError` from `lib/mock-utils.ts`, consumed via TanStack Query. Verify with `npx tsc --noEmit` + `eslint` + `curl`.
- **Forms use `Field`/`FieldLabel`/`FieldError` + React Hook Form `Controller`** — this project's shadcn style (`base-nova`) has no real `Form` component. Working reference: `features/aggregator/record-sale-dialog.tsx`.
- **WSL**: prepend `/home/yashm/.nvm/versions/node/v24.19.0/bin` to `PATH` before any npm/node command.
- **Turbopack crashes in this environment** compiling `app/globals.css` — always `node_modules/.bin/next dev --webpack -p <port>`, never bare `next dev`.
- **Only one `next dev` runs per checkout** — if your port is refused, curl whichever port is already live, or fall back to `tsc` + code reading. Report honestly what you could and couldn't verify; charts and interactive table state are client-rendered and **cannot** be curl-verified past the loading skeleton.
- **Git commits are expected to fail** (`.git/objects` permission, and separately `fatal: empty ident name`). Attempt each commit step as written, note the failure, move on. Never attempt sudo/chown/git config.
- **Design craft**: load `design-taste-frontend` (at `.claude/skills/design-taste-frontend`) and `emil-design-eng` before writing visual/JSX code. Match the existing dark near-black + brass-gold system.
- **Charts additionally require the `dataviz` skill** — load it before writing any chart code (see Task 4).
- **All money via `formatINR`** from `lib/utils.ts`.
- **Never display raw Aadhaar numbers anywhere** — masked/status-only, per SAD §8.7. Real platform rule.

---

## Foundation (sequential — Tasks 1→4 must complete in order before any track starts)

### Task 1: Admin types, mock data, analytics series

**Files:**
- Create: `types/admin.ts`
- Create: `lib/mock-data/admin.ts`, `lib/mock-data/admin-analytics.ts`
- Create: `features/admin/admin-data.ts`

**Interfaces:**
- Consumes: `mockArtworks`, `mockArtists`, `mockOrders`, `mockAggregatorHoldings` (existing fixtures — reuse, never modify).
- Produces: every type and fixture below; all four tracks import from here.

- [ ] **Step 1: Write `types/admin.ts`**

```ts
import type { ArtworkStatus } from "./artwork";
import type { OrderStatus } from "./order";

export type UserRole = "artist" | "aggregator" | "customer" | "admin";
export type UserStatus = "pending" | "active" | "suspended" | "blocked";
export type KycStatus = "pending" | "submitted" | "under_review" | "approved" | "rejected";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;      // ISO
  lastLoginAt: string | null;
  kycStatus?: KycStatus;  // artists only
  companyName?: string;   // aggregators only
}

export type WithdrawalStatus = "pending" | "completed" | "rejected" | "failed";

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: Extract<UserRole, "artist" | "aggregator">;
  amount: number;                 // >= 1000 per platform rule
  bankAccountMasked: string;      // e.g. "XXXXXXXX1234" — never a full number
  walletBalance: number;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt: string | null;
}

export type SettlementStatus = "pending" | "processed" | "failed";

export interface Settlement {
  id: string;
  orderId: string;
  artworkTitle: string;
  artistName: string;
  artistAmount: number;
  aggregatorCommission: number;
  platformRevenue: number;
  status: SettlementStatus;
  createdAt: string;
  processedAt: string | null;
}

export type AuditAction =
  | "artwork.approved" | "artwork.rejected" | "artwork.delisted"
  | "kyc.approved" | "kyc.rejected"
  | "withdrawal.approved" | "withdrawal.rejected"
  | "user.suspended" | "user.activated"
  | "category.created" | "category.updated" | "category.deleted"
  | "settings.updated";

export interface AuditLogEntry {
  id: string;
  adminName: string;
  action: AuditAction;
  entityType: "artwork" | "user" | "withdrawal" | "category" | "settings";
  entityId: string;
  entityLabel: string;   // human-readable, e.g. the artwork title
  detail?: string;       // e.g. a rejection reason
  createdAt: string;     // ISO
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  artworkCount: number;
}

export interface PlatformSettings {
  markupPercent: number;            // 30
  gstPercent: number;               // 5
  minWithdrawalAmount: number;      // 1000
  insuranceThreshold: number;       // 20000
  aggregatorCommissionPercent: number; // 20 (of the markup)
}

export interface AdminKpis {
  gmv: number;
  platformRevenue: number;
  artistPayouts: number;
  totalOrders: number;
  activeArtworks: number;
  totalUsers: number;
  pendingArtworkApprovals: number;
  pendingKyc: number;
  pendingWithdrawals: number;
}

export interface AdminActivityEvent {
  id: string;
  label: string;
  detail: string;
  at: string;   // ISO
  kind: "artwork" | "order" | "user" | "withdrawal" | "settlement";
}

export type AdminArtworkStatusFilter = ArtworkStatus | "all";
export type AdminOrderStatusFilter = OrderStatus | "all";
```

- [ ] **Step 2: Write `features/admin/admin-data.ts`**

```ts
// Mirrors ARTIST / AGGREGATOR / mockCustomer — no real admin auth exists.
export const ADMIN = {
  name: "Ops Console",
  email: "ops@galleryzone.art",
  avatar: "/early-program/avatar-1.png",  // verify this path exists; use any real file under public/
};

// Fixed "today" anchor matching every other mock-data file.
export const ADMIN_TODAY = new Date("2026-08-11T00:00:00.000Z");
```

- [ ] **Step 3: Write `lib/mock-data/admin.ts`**

Declare a local `TODAY = new Date("2026-08-11T00:00:00.000Z")` and `daysAgo(n)` helper, exactly as `lib/mock-data/artworks.ts` and `customer.ts` already do (read one of them first and match the convention). Export:

- `mockPendingArtworks: Artwork[]` — ~12 additional artworks in `pending_approval` (majority), plus 2 `draft` and 1 `returned`. **These are separate from `mockArtworks`** so the public marketplace is untouched. Reuse the same `Artwork` type and the same field discipline (no price/valuation language in descriptions, 3-8 images, real `artistId`s drawn from `mockArtists`).
- `mockAdminUsers: AdminUser[]` — ~15 additional users spanning all three non-admin roles, mixed `status`, and — for artists — mixed `kycStatus` with **at least 4 in `submitted`/`under_review`** (the KYC queue needs real work waiting). Also derive `AdminUser` entries for the 7 existing `mockArtists` so the Artists table shows the same people the public site does; do this by mapping over `mockArtists` rather than hand-duplicating them, so the two can't drift.
- `mockWithdrawals: WithdrawalRequest[]` — ~10, with at least 4 `pending`. All `amount >= 1000`. `bankAccountMasked` always in `XXXXXXXX1234` form.
- `mockSettlements: Settlement[]` — ~12 across `pending`/`processed`/`failed`, referencing real order ids where possible. Amounts must be internally consistent with the platform formula: `artistAmount` + `aggregatorCommission` + `platformRevenue` should reconcile against the order total.
- `mockCategories: Category[]` — derived from the distinct `category` values actually present in `mockArtworks` (compute `artworkCount` from the real fixture, don't hardcode counts that could drift).
- `mockAuditLog: AuditLogEntry[]` — ~20 historical entries spread over recent weeks, spanning several `AuditAction` values.
- `defaultPlatformSettings: PlatformSettings` — `{ markupPercent: 30, gstPercent: 5, minWithdrawalAmount: 1000, insuranceThreshold: 20000, aggregatorCommissionPercent: 20 }`. These are the real documented values (Onboarding Guide / SAD) — do not invent different ones.
- `mockAdminKpis: AdminKpis` and `mockAdminActivity: AdminActivityEvent[]` — the overview's numbers and feed. `pendingArtworkApprovals` / `pendingKyc` / `pendingWithdrawals` must be **computed** from the fixtures above, not hardcoded, so the KPI tiles always agree with what the queues actually contain.

- [ ] **Step 4: Write `lib/mock-data/admin-analytics.ts`**

Pre-baked demonstration series — **explicitly not** aggregated from order fixtures (see spec §3; computing real trends would need hundreds of fake orders, which was rejected). Add a file-header comment saying exactly that, so a future reader doesn't mistake it for derived data.

```ts
export type RangeKey = "30d" | "90d" | "12m";

export interface RevenuePoint { label: string; gmv: number; platform: number; artist: number; aggregator: number; }
export interface VolumePoint { label: string; orders: number; }
export interface CategoryPerformance { category: string; revenue: number; orders: number; }
export interface FunnelStage { stage: string; count: number; }
export interface UserGrowthPoint { label: string; artists: number; aggregators: number; customers: number; }
export interface TierDistribution { tier: string; count: number; }
export interface TopPerformer { name: string; revenue: number; count: number; }

export const revenueSeries: Record<RangeKey, RevenuePoint[]> = { /* ... */ };
export const volumeSeries: Record<RangeKey, VolumePoint[]> = { /* ... */ };
export const categoryPerformance: CategoryPerformance[] = [ /* ... */ ];
export const artworkFunnel: FunnelStage[] = [ /* draft → pending → marketplace → reserved → sold → settled */ ];
export const userGrowthSeries: Record<RangeKey, UserGrowthPoint[]> = { /* ... */ };
export const verificationTiers: TierDistribution[] = [ /* Gold / 2-tier / 1-tier / unverified */ ];
export const topArtists: TopPerformer[] = [ /* ... */ ];
export const topAggregators: TopPerformer[] = [ /* ... */ ];
```

Internal coherence matters: for every `RevenuePoint`, `platform + artist + aggregator` should equal `gmv`; category revenue should roughly sum to the 12m GMV total; funnel counts should decrease monotonically. Charts that visibly contradict each other are worse than no charts.

- [ ] **Step 5: Verify** — `npx tsc --noEmit` clean. Additionally run a quick Node script that asserts the coherence rules above (funnel monotonic, revenue components sum to gmv, KPI pending-counts match fixture lengths) and report the result; catching a fixture inconsistency now is far cheaper than four tracks rendering contradictory numbers.

- [ ] **Step 6: Commit**

```bash
git add types/admin.ts lib/mock-data/admin.ts lib/mock-data/admin-analytics.ts features/admin/admin-data.ts
git commit -m "feat: add admin types, fixtures, and analytics demo series"
```

---

### Task 2: Admin services, hooks, and the live audit store

**Files:**
- Create: `services/adminService.ts`
- Create: `store/useAdminAuditStore.ts`
- Create: `hooks/useAdminDashboard.ts`, `hooks/useAdminModeration.ts`, `hooks/useAdminUsers.ts`, `hooks/useAdminCommerce.ts`, `hooks/useAdminSystem.ts`

**Interfaces:**
- Consumes: everything from Task 1; `mockDelay`/`mockError`.
- Produces: the service + hooks every track calls.

- [ ] **Step 1: Write `store/useAdminAuditStore.ts`**

```ts
import { create } from "zustand";
import type { AuditLogEntry } from "@/types/admin";

interface AdminAuditState {
  entries: AuditLogEntry[];               // session-appended only
  append: (entry: Omit<AuditLogEntry, "id" | "createdAt">) => void;
}

export const useAdminAuditStore = create<AdminAuditState>((set) => ({
  entries: [],
  append: (entry) =>
    set((state) => ({
      entries: [
        { ...entry, id: `audit-${crypto.randomUUID()}`, createdAt: new Date().toISOString() },
        ...state.entries,
      ],
    })),
}));
```
Not persisted (unlike the wishlist store) — an audit trail that survives reload but isn't real would be actively misleading. Session-only is the honest choice. Scoped exception to "server data doesn't live in Zustand", same reasoning as the wishlist store: there is no server.

- [ ] **Step 2: Write `services/adminService.ts`**

One service object with grouped methods. Every mutation resolves a plausible next value via `mockDelay` **without** mutating the shared fixture arrays — call sites apply `queryClient.setQueryData` (the pattern the Customer Account track established; read `features/account/address-form-dialog.tsx` for a working example of that call-site merge).

```ts
export const adminService = {
  // overview + analytics
  getKpis: () => mockDelay(mockAdminKpis),
  getActivity: () => mockDelay(mockAdminActivity),

  // moderation
  listPendingArtworks: () => mockDelay(mockPendingArtworks.filter(a => a.status === "pending_approval")),
  getPendingArtwork: (id: string) => mockDelay(mockPendingArtworks.find(a => a.id === id)),
  approveArtwork: (id: string) => mockDelay({ id, status: "marketplace" as const }),
  rejectArtwork: (id: string, reason: string) => mockDelay({ id, status: "returned" as const, reason }),
  listKycQueue: () => mockDelay(/* artists with kycStatus submitted|under_review */),
  approveKyc: (userId: string) => mockDelay({ userId, kycStatus: "approved" as const }),
  rejectKyc: (userId: string, reason: string) => mockDelay({ userId, kycStatus: "rejected" as const, reason }),
  listWithdrawals: () => mockDelay(mockWithdrawals),
  approveWithdrawal: (id: string) => mockDelay({ id, status: "completed" as const }),
  rejectWithdrawal: (id: string, reason: string) => mockDelay({ id, status: "rejected" as const, reason }),

  // catalog
  listAllArtworks: () => mockDelay([...mockArtworks, ...mockPendingArtworks]),
  getArtworkAdmin: (id: string) => mockDelay(/* search both sets */),
  delistArtwork: (id: string) => mockDelay({ id, status: "returned" as const }),
  listCategories: () => mockDelay(mockCategories),
  createCategory: (name: string) => mockDelay(/* new Category, slug derived from name */),
  updateCategory: (id: string, name: string) => mockDelay(/* ... */),
  deleteCategory: (id: string) => mockDelay({ id }),

  // people
  listUsers: (role?: UserRole) => mockDelay(/* filtered mockAdminUsers */),
  getUser: (id: string) => mockDelay(mockAdminUsers.find(u => u.id === id)),
  setUserStatus: (id: string, status: UserStatus) => mockDelay({ id, status }),

  // commerce
  listOrders: () => mockDelay(mockOrders),
  listSettlements: () => mockDelay(mockSettlements),
  retrySettlement: (id: string) => mockDelay({ id, status: "processed" as const }),

  // system
  listAuditLog: () => mockDelay(mockAuditLog),
  getSettings: () => mockDelay(defaultPlatformSettings),
  updateSettings: (patch: Partial<PlatformSettings>) => mockDelay({ ...defaultPlatformSettings, ...patch }),
  listReports: () => mockDelay(/* seeded report rows */),
  generateReport: (input: { type: string; from: string; to: string }) => mockDelay(/* new report row */),
};
```
(Sketch — write the real filter/find/derive logic. `deleteCategory` must reject via `mockError` when the category's `artworkCount > 0`, matching the spec's guard.)

- [ ] **Step 3: Write the hooks**

Group by area, one file each, following the exact `useQuery`/`useMutation` + `invalidateQueries` shape already used in `hooks/useAggregatorCollection.ts` (read it first). Query keys: `['admin-kpis']`, `['admin-activity']`, `['admin-pending-artworks']`, `['admin-pending-artwork', id]`, `['admin-kyc-queue']`, `['admin-withdrawals']`, `['admin-artworks']`, `['admin-artwork', id]`, `['admin-categories']`, `['admin-users', role]`, `['admin-user', id]`, `['admin-orders']`, `['admin-settlements']`, `['admin-audit-log']`, `['admin-settings']`, `['admin-reports']`.

Every mutation hook additionally invalidates `['admin-kpis']` where the action changes a pending-queue count (artwork approve/reject, KYC approve/reject, withdrawal approve/reject), so the overview's tiles stay truthful after you act.

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean. No UI yet.

- [ ] **Step 5: Commit**

```bash
git add services/adminService.ts store/useAdminAuditStore.ts hooks/useAdmin*.ts
git commit -m "feat: add admin services, hooks, and session audit store"
```

---

### Task 3: AdminShell, AdminDataTable, and shared admin UI

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `features/admin/admin-shell.tsx`, `features/admin/admin-data-table.tsx`, `features/admin/admin-page-header.tsx`, `features/admin/admin-status-badge.tsx`, `features/admin/confirm-action-dialog.tsx`, `features/admin/reject-reason-dialog.tsx`
- Modify: `features/auth/components/login-form.tsx`

**Interfaces:**
- Produces: the shell every admin page renders inside, plus the table and dialogs all four tracks reuse. **Get these right — four tracks depend on them.**

- [ ] **Step 1: Implement `AdminShell`**

Fourth independent copy-and-adapt of the shell pattern (read `features/aggregator/aggregator-shell.tsx` — the closest sibling). Differences from the others: nav is **grouped with section headings**, not a flat list —

- Overview → `/admin`
- Analytics → `/admin/analytics`
- **Moderation**: Artwork Queue `/admin/moderation/artworks` · KYC `/admin/moderation/kyc` · Withdrawals `/admin/moderation/withdrawals`
- **Catalog**: Artworks `/admin/artworks` · Categories `/admin/categories`
- **People**: Artists `/admin/artists` · Aggregators `/admin/aggregators` · Customers `/admin/customers`
- **Commerce**: Orders `/admin/orders` · Settlements `/admin/settlements`
- **System**: Audit Logs `/admin/audit-logs` · Reports `/admin/reports` · Settings `/admin/settings`

Each Moderation item shows a live pending-count badge sourced from `useAdminDashboard`'s KPIs, so waiting work is visible from anywhere. Profile card uses `ADMIN` from `features/admin/admin-data.ts`.

- [ ] **Step 2: Implement `AdminDataTable`**

One generic table used by every table page. Props:
```ts
interface AdminDataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface AdminDataTableProps<T> {
  rows: T[];
  columns: AdminDataTableColumn<T>[];
  isLoading?: boolean;
  getRowKey: (row: T) => string;
  getRowHref?: (row: T) => string;      // whole-row link when provided
  searchPlaceholder?: string;
  searchValue?: (row: T) => string;      // fields searched
  filters?: Array<{ key: string; label: string; options: Array<{value: string; label: string}>; matches: (row: T, value: string) => boolean }>;
  pageSize?: number;                     // default 15
  emptyTitle: string;
  emptyDescription: string;
}
```
Includes: search input (debounced 300ms — reuse the pattern from `features/marketplace/marketplace-search-bar.tsx`), zero or more dropdown filters, click-to-sort headers, offset pagination with page numbers (SAD §9.3 — jump-to-page matters for admin), skeleton rows while `isLoading`, and `EmptyState` (`components/shared/empty-state.tsx`) when there are no rows. No row virtualization (spec §7 explains why).

- [ ] **Step 3: Implement the small shared pieces**

- `AdminPageHeader` — title, optional description, optional right-side action slot. Every admin page uses it, so headings stay consistent.
- `AdminStatusBadge` — one badge component covering `ArtworkStatus | OrderStatus | UserStatus | WithdrawalStatus | SettlementStatus | KycStatus` via a status→tone map (positive / pending / negative / neutral). Follow the visual convention already set by `features/dashboard/artwork-status-pill.tsx` (read it) rather than inventing a second status-pill language.
- `ConfirmActionDialog` — generic "are you sure" for approve/suspend/delete actions (title, body, confirm label, destructive flag, async onConfirm with pending state).
- `RejectReasonDialog` — required-reason dialog used by artwork reject, KYC reject, and withdrawal reject. Preset common reasons as quick-select chips plus a free-text field; reason is mandatory (Zod-validated, non-empty), because "rejected with no reason" is useless to the person on the receiving end.

- [ ] **Step 4: Add Admin to the login dev toggle**

In `features/auth/components/login-form.tsx`, add `"admin"` to the dev-only "Sign in as" role selector, redirecting to `/admin`. Read the file first — this is a small targeted edit to working code, matching how the existing three roles are wired.

- [ ] **Step 5: Verify**

Temporarily create `app/admin/test/page.tsx` rendering `<AdminDataTable>` with a handful of hardcoded rows plus each shared component; run the dev server (`--webpack`), curl it, confirm the shell renders with all grouped nav sections and the table's search/filter/sort/pagination controls appear in the HTML. **Delete the throwaway page afterward** and confirm it 404s. Also curl `/login` and confirm the Admin option is present in the role selector.

- [ ] **Step 6: Commit**

```bash
git add app/admin/layout.tsx features/admin/ features/auth/components/login-form.tsx
git commit -m "feat: add admin shell, data table, shared admin UI, admin login option"
```

---

### Task 4: Recharts install + themed chart wrappers

**Files:**
- Create: `features/admin/charts/chart-card.tsx`, `features/admin/charts/chart-theme.ts`, `features/admin/charts/revenue-area-chart.tsx`, `features/admin/charts/volume-bar-chart.tsx`, `features/admin/charts/category-bar-chart.tsx`, `features/admin/charts/funnel-chart.tsx`, `features/admin/charts/growth-line-chart.tsx`, `features/admin/charts/tier-donut-chart.tsx`
- Modify: `package.json` (add `recharts`)

**Interfaces:**
- Consumes: the series types from `lib/mock-data/admin-analytics.ts` (Task 1).
- Produces: every chart component the Overview and Analytics pages render.

- [ ] **Step 1: Load the `dataviz` skill first**

Mandatory before writing chart code. Reconcile its palette guidance with this project's **existing** tokens in `app/globals.css` (`--gold`, `--gold-bright`, `--gold-deep`, `--chart-1` … `--chart-5`, `--muted-foreground`, `--border`) — adapt its method, don't import a foreign palette that would clash with the established brand.

- [ ] **Step 2: Install Recharts**

```bash
npm install recharts
```
The existing hand-rolled `features/dashboard/revenue-chart.tsx` is **not** migrated — leave it exactly as it is.

- [ ] **Step 3: Write `chart-theme.ts`**

Shared constants every chart imports: series color order (from the CSS custom properties above, read at runtime via `var(--…)` so both themes work), axis/grid/tick styling, tooltip content style, and a `formatCompactINR` helper for axis ticks (`₹1.2L`, `₹45k`) since full `formatINR` output is far too long for an axis label.

- [ ] **Step 4: Write `ChartCard`**

Shared frame: title, optional subtitle/description, optional right-side control slot (e.g. the range selector), fixed-height `ResponsiveContainer` body, and a proper empty state. Every chart in admin sits in one of these so the analytics page reads as one system rather than six independently-styled widgets.

- [ ] **Step 5: Write the six chart wrappers**

Each takes typed data props (no data fetching inside — pages pass data in) and renders a themed Recharts chart inside `ChartCard`:
- `RevenueAreaChart` — stacked area, platform / artist / aggregator over time.
- `VolumeBarChart` — order counts over time.
- `CategoryBarChart` — horizontal bars, revenue by category.
- `FunnelChart` — artwork lifecycle stages; a horizontal bar chart with descending values is fine and clearer than a literal funnel shape.
- `GrowthLineChart` — multi-line user growth by role.
- `TierDonutChart` — verification tier distribution, donut with a centered total.

All must: render correct colors in **both** light and dark (never hardcode hex), include accessible `role`/`aria-label` on the chart container, and handle an empty/short data array without crashing.

- [ ] **Step 6: Verify**

`npx tsc --noEmit` and `eslint` clean. Build a temporary `app/admin/chart-test/page.tsx` rendering all six against the Task 1 fixtures, curl it to confirm the page compiles and returns 200 (**note honestly**: Recharts renders client-side, so curl will only show the container/skeleton — this confirms compilation and mount, not visual correctness, which no tool in this environment can confirm). Delete the throwaway page and confirm it 404s.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json features/admin/charts/
git commit -m "feat: add recharts and themed admin chart wrappers"
```

---

## Track A — Overview + Analytics (Tasks 5-6)

### Task 5: Overview page

**Files:** Create `app/admin/page.tsx`, `features/admin/overview/admin-kpi-grid.tsx`, `features/admin/overview/moderation-queue-cards.tsx`, `features/admin/overview/admin-activity-feed.tsx`

- [ ] **Step 1** — `AdminKpiGrid`: nine tiles from `useAdminKpis()` (GMV, platform revenue, artist payouts, total orders, active artworks, total users, and the three pending counts). Money via `formatINR`. The three pending tiles are visually distinct (they're *actionable*, the rest are informational) and link to their queues.
- [ ] **Step 2** — `ModerationQueueCards`: three cards (Artworks / KYC / Withdrawals) each showing count + the oldest waiting item's age + a "Review" link. When a queue is empty, say so positively rather than rendering an empty card.
- [ ] **Step 3** — `AdminActivityFeed`: recent events from `useAdminActivity()`, newest first, icon per `kind`, relative timestamps computed against `ADMIN_TODAY` (not `Date.now()` — see the fixed-anchor convention in `features/aggregator/aggregator-data.ts`).
- [ ] **Step 4** — Assemble `app/admin/page.tsx` with `AdminPageHeader` + a compact `RevenueAreaChart` (30d) for at-a-glance trend.
- [ ] **Step 5: Verify** — curl `/admin` → 200, KPI labels present in HTML; confirm pending counts match the queue lengths from Task 1's fixtures.
- [ ] **Step 6: Commit** — `git add app/admin/page.tsx features/admin/overview/ && git commit -m "feat: add admin overview page"`

### Task 6: Analytics page

**Files:** Create `app/admin/analytics/page.tsx`, `features/admin/analytics/analytics-view.tsx`, `features/admin/analytics/range-selector.tsx`, `features/admin/analytics/top-performers-table.tsx`

- [ ] **Step 1** — `RangeSelector`: 30d / 90d / 12m segmented control, local state, drives which series the charts read.
- [ ] **Step 2** — `TopPerformersTable`: compact two-panel table (top artists, top aggregators) with revenue + count, using `formatINR`.
- [ ] **Step 3** — `AnalyticsView` (client): summary stat row, then a deliberate chart layout — revenue area (full width) → volume bar + category bar (side by side) → funnel + tier donut (side by side) → growth line (full width) → top performers. Vary the visual weight; a uniform grid of same-size cards reads as a template.
- [ ] **Step 4** — Assemble the page with `AdminPageHeader`.
- [ ] **Step 5: Verify** — curl `/admin/analytics` → 200 and compiles. **State plainly** that chart interiors are client-rendered and unverifiable by curl; `tsc`/`eslint` clean is the real check.
- [ ] **Step 6: Commit** — `git add app/admin/analytics features/admin/analytics/ && git commit -m "feat: add admin analytics page"`

---

## Track B — Moderation (Tasks 7-9)

### Task 7: Artwork moderation queue + review detail

**Files:** Create `app/admin/moderation/artworks/page.tsx`, `app/admin/moderation/artworks/[artworkId]/page.tsx`, `features/admin/moderation/artwork-queue-table.tsx`, `features/admin/moderation/artwork-review-panel.tsx`, `features/admin/moderation/eligibility-checklist.tsx`

- [ ] **Step 1** — `ArtworkQueueTable` via `AdminDataTable`: thumbnail, title, artist (+ verification tier), category, submitted-ago, listing type. Row → review page.
- [ ] **Step 2** — `EligibilityChecklist`: the five real criteria from `Artist Complete workflow.md` — 100% handmade · no replicas · no AI/digital prints/NFTs · artist owns all rights · no IP infringement — as reviewer checkboxes (local state). Approve stays disabled until all five are checked; rejecting requires no checklist. This encodes the actual curator gate rather than decorating the page with copy.
- [ ] **Step 3** — `ArtworkReviewPanel`: all images at reviewable size (click to enlarge via `Dialog`), full metadata, artist context (tier, prior approved count), the checklist, and Approve / Reject actions. Reject opens `RejectReasonDialog` with presets sourced from the real criteria (e.g. "Appears to be a reproduction", "AI-generated or digital print", "Insufficient image quality", "Incomplete documentation").
- [ ] **Step 4** — Wire actions: on success, `setQueryData` to drop the item from `['admin-pending-artworks']`, invalidate `['admin-kpis']`, append to `useAdminAuditStore` (`artwork.approved` / `artwork.rejected`, `entityLabel` = title, `detail` = reason), `toast.success`, and route back to the queue.
- [ ] **Step 5: Verify** — curl both routes; confirm queue length matches the `pending_approval` fixture count and an unknown `artworkId` 404s. Note that the approve/reject flow is client-interactive and unverifiable by curl.
- [ ] **Step 6: Commit**

### Task 8: KYC queue

**Files:** Create `app/admin/moderation/kyc/page.tsx`, `features/admin/moderation/kyc-queue-table.tsx`, `features/admin/moderation/kyc-review-dialog.tsx`

- [ ] **Step 1** — Table of artists with `kycStatus` `submitted`/`under_review`: name, email, submitted-ago, current status.
- [ ] **Step 2** — `KycReviewDialog`: artist identity summary, a **masked** Aadhaar indicator (e.g. `XXXX XXXX 4321`) with an explicit note that full numbers are never exposed to the console, bank-account-masked + IFSC, and Approve / Reject (reason required via `RejectReasonDialog`). **Never render a full Aadhaar number** — SAD §8.7, a real platform rule, not a UI preference.
- [ ] **Step 3** — Wire actions: cache update, `['admin-kpis']` invalidation, audit append (`kyc.approved`/`kyc.rejected`), toast.
- [ ] **Step 4: Verify + Commit**

### Task 9: Withdrawal queue

**Files:** Create `app/admin/moderation/withdrawals/page.tsx`, `features/admin/moderation/withdrawal-queue-table.tsx`, `features/admin/moderation/withdrawal-review-dialog.tsx`

- [ ] **Step 1** — Table: requester (+role), amount, wallet balance, masked bank ref, requested-ago, status. Default filter to `pending`, with a filter to see all.
- [ ] **Step 2** — `WithdrawalReviewDialog`: amount vs available balance (flag clearly if amount exceeds balance — a real approval consideration), minimum-withdrawal rule shown (₹1,000, from settings), Approve / Reject with reason.
- [ ] **Step 3** — Wire actions: cache update, `['admin-kpis']` invalidation, audit append, toast.
- [ ] **Step 4: Verify + Commit**

---

## Track C — Catalog + People (Tasks 10-13)

### Task 10: All-artworks table + admin artwork detail

**Files:** Create `app/admin/artworks/page.tsx`, `app/admin/artworks/[artworkId]/page.tsx`, `features/admin/catalog/artwork-admin-table.tsx`, `features/admin/catalog/artwork-admin-detail.tsx`

- [ ] **Step 1** — Table over `listAllArtworks()` (public + pending sets combined): thumbnail, title, artist, category, status badge, customer price, listing type. Filters: status, category. Search: title/artist.
- [ ] **Step 2** — Detail: images, full metadata, **status history timeline** (reuse the visual pattern from `features/verify/provenance-timeline.tsx`), current owner/aggregator, COA + NFC identifiers, insurance state, and a Delist action (`ConfirmActionDialog`, destructive) that appends `artwork.delisted` to the audit store.
- [ ] **Step 3: Verify + Commit**

### Task 11: Categories CRUD

**Files:** Create `app/admin/categories/page.tsx`, `features/admin/catalog/category-table.tsx`, `features/admin/catalog/category-form-dialog.tsx`

- [ ] **Step 1** — Table: name, slug, artwork count, actions.
- [ ] **Step 2** — Add/edit dialog (RHF + `Controller` + `Field`), slug auto-derived from name but editable, uniqueness validated against existing categories.
- [ ] **Step 3** — Delete guarded: blocked with an explanatory message when `artworkCount > 0` (the service rejects via `mockError`; surface that as an inline explanation, not a bare toast). Audit-append all three operations.
- [ ] **Step 4: Verify + Commit**

### Task 12: People tables (Artists / Aggregators / Customers)

**Files:** Create `app/admin/artists/page.tsx`, `app/admin/aggregators/page.tsx`, `app/admin/customers/page.tsx`, `features/admin/people/user-table.tsx`

- [ ] **Step 1** — One shared `UserTable` component parameterized by role (the three pages differ only in role filter and which columns show — artists get KYC status + verification tier, aggregators get company name, customers get order count). This is genuine shared behavior across three near-identical pages, unlike the shells, so one component with a `role` prop is correct here.
- [ ] **Step 2** — Each page: `AdminPageHeader` + `UserTable` with status filter + search, rows linking to the matching detail route.
- [ ] **Step 3: Verify + Commit**

### Task 13: People detail pages

**Files:** Create `app/admin/artists/[artistId]/page.tsx`, `app/admin/aggregators/[aggregatorId]/page.tsx`, `app/admin/customers/[customerId]/page.tsx`, `features/admin/people/user-detail-header.tsx`, `features/admin/people/suspend-user-action.tsx`

- [ ] **Step 1** — `UserDetailHeader`: avatar/initials, name, email, phone, role, status badge, joined date, last login + `SuspendUserAction` (`ConfirmActionDialog`; suspend/activate toggle, audit-appends `user.suspended`/`user.activated`).
- [ ] **Step 2** — Artist detail: verification tier breakdown (reuse `VerifiedBadge` and the tier logic from `types/artist.ts`), KYC status, their artworks grid, wallet/settlement summary.
- [ ] **Step 3** — Aggregator detail: company info, current holdings (from `mockAggregatorHoldings`), commission earned.
- [ ] **Step 4** — Customer detail: profile, order history (from `mockOrders`), saved addresses count.
- [ ] **Step 5** — All three `notFound()` on unknown id.
- [ ] **Step 6: Verify + Commit**

---

## Track D — Commerce + System (Tasks 14-17)

### Task 14: Orders table + detail

**Files:** Create `app/admin/orders/page.tsx`, `app/admin/orders/[orderId]/page.tsx`, `features/admin/commerce/order-admin-table.tsx`, `features/admin/commerce/order-admin-detail.tsx`

- [ ] **Step 1** — Table: order id (short), artwork, buyer, amount, status badge, placed-ago. Status filter + search.
- [ ] **Step 2** — Detail: artwork summary, buyer + delivery address, price breakdown (amount / GST / delivery — reuse `features/account/order-price-breakdown.tsx` if its props allow, otherwise mirror it), status timeline, and the linked settlement if one exists.
- [ ] **Step 3: Verify + Commit**

### Task 15: Settlements

**Files:** Create `app/admin/settlements/page.tsx`, `features/admin/commerce/settlement-table.tsx`, `features/admin/commerce/settlement-detail-drawer.tsx`

- [ ] **Step 1** — Table: order ref, artwork, artist, artist amount, aggregator commission, platform revenue, status, processed-ago. Status filter.
- [ ] **Step 2** — Detail drawer (`Dialog`, not a route — spec §4): full breakdown showing the three components summing to the order total, plus a **Retry** action on `failed` rows (`ConfirmActionDialog` → `retrySettlement` → cache update + audit append + toast).
- [ ] **Step 3: Verify + Commit**

### Task 16: Audit logs + Reports

**Files:** Create `app/admin/audit-logs/page.tsx`, `app/admin/reports/page.tsx`, `features/admin/system/audit-log-table.tsx`, `features/admin/system/report-generator.tsx`

- [ ] **Step 1** — `AuditLogTable`: merges `useAdminAuditStore().entries` (session actions, newest first) **above** the seeded `mockAuditLog`, so actions taken elsewhere in this session appear immediately. Columns: timestamp, admin, action badge, entity type, entity label, detail. Filters: action type, entity type. **Strictly read-only** — no edit/delete affordances anywhere; add a short inline note that audit entries are immutable by design (SAD §8.8).
- [ ] **Step 2** — `ReportGenerator`: form (report type select, date range, optional filters) → `generateReport` → new row appears in the generated-reports list with a download affordance. The download is necessarily inert in a mock build — label it honestly (e.g. a disabled/"demo" state) rather than a link that silently does nothing.
- [ ] **Step 3: Verify + Commit**

### Task 17: Platform settings

**Files:** Create `app/admin/settings/page.tsx`, `features/admin/system/settings-form.tsx`, `features/admin/system/pricing-preview.tsx`

- [ ] **Step 1** — `SettingsForm` (RHF + `Controller` + `Field`): markup %, GST %, minimum withdrawal, insurance threshold, aggregator commission %. Zod-validated (percentages 0-100, amounts positive).
- [ ] **Step 2** — `PricingPreview`: a live worked example that recalculates as the form values change — artist lists at ₹30,000 → +markup% → customer price → +GST% → final, with the aggregator's share broken out. This is what makes the settings page trustworthy: you can see what a number actually does before saving.
- [ ] **Step 3** — Save → `updateSettings` → cache update, audit append (`settings.updated` with a detail string naming which fields changed), toast.
- [ ] **Step 4: Verify + Commit**

---

## Self-review notes (already applied)

- **Spec coverage**: every section of spec §4 maps to a task; §5 charting → Task 4; §6 consequences (cache updates + live audit) → wired into Tasks 7-9, 10-11, 13, 15-17; §7 shared table → Task 3.
- **Type consistency**: `types/admin.ts` (Task 1) is the single definition source; `AdminDataTable`'s generic column API (Task 3) is used verbatim by Tasks 7, 9, 10, 11, 12, 14, 15, 16.
- **Shared-abstraction judgment**: `AdminShell` is a fourth *independent* shell (consistent with prior precedent, avoids destabilizing three working portals), but `UserTable` (Task 12) **is** shared across three pages because those three genuinely differ only in configuration — the distinction is deliberate, not inconsistent.
- **Real-rule fidelity**: Aadhaar masking (§8.7), immutable audit logs (§8.8), offset pagination for admin tables (§9.3), the five eligibility criteria, and the documented platform constants (30% / 5% / ₹1,000 / ₹20,000 / 20%) are all pulled from the source docs, not invented.
