# GalleryZone Frontend — Admin Dashboard

Status: Approved for planning
Date: 2026-08-12
Scope owner: frontend-web (Next.js 16/React 19 App Router)

## 1. Purpose

The Admin Dashboard is the last unbuilt role in the platform. The prior two
specs (`2026-08-11-frontend-remaining-pages`, `2026-08-12-customer-account-checkout`)
both listed it as out of scope because the architecture doc places it in a
separate app. This spec covers building it — as a route group inside the
existing `frontend-web` app, not a separate application.

Same constraint as every prior phase: **pure frontend UI, no real backend.**
Mock services with fake delay, consumed through TanStack Query hooks.

### 1.1 Why a route group, not a separate app

The SAD (§7.6) specifies `admin.galleryzone.com` as a separate Vercel project.
That remains the right production topology and this build does not contradict
it — but in a mock-data phase, a separate app would have to duplicate every
fixture, type, and shared component, and admin's data would immediately drift
out of sync with the public site's. Building at `app/admin/*` means approving
an artwork in admin genuinely changes what the marketplace shows, which is the
entire point of an admin console. The section is self-contained
(`app/admin/**`, `features/admin/**`, `services/adminService.ts`) and can be
extracted into its own app later without redesign — the same "extract, don't
rewrite" principle the SAD applies to backend modules (§1.7).

## 2. Mock admin identity

Following the established precedent (`ARTIST` in `dashboard-data.ts`,
`AGGREGATOR` in `aggregator-data.ts`, `mockCustomer` in
`lib/mock-data/customer.ts`), a single hardcoded `ADMIN` constant in
`features/admin/admin-data.ts`. There is no real auth anywhere in this app.

`features/auth/components/login-form.tsx`'s dev role toggle currently offers
Artist / Aggregator / Customer — add **Admin**, redirecting to `/admin`.

## 3. Data strategy

Deliberately modest, per explicit direction: enough rows to make tables,
pagination, filtering and search feel real, **not** a large generated corpus.

- **Reuse unchanged**: `mockArtworks` (18), `mockArtists` (7),
  `mockAggregatorHoldings` (6), `mockOrders` (6), `mockCustomer`,
  `mockAddresses`. The public site must be completely unaffected.
- **Add** (`lib/mock-data/admin.ts`): a modest supplementary set so admin
  tables aren't near-empty —
  - ~12 additional artworks in `pending_approval` / `draft` / `returned`
    states (the moderation queue needs real pending items; the public
    fixtures are almost all already-approved).
  - ~15 additional users across roles with varied `status`
    (`pending`/`active`/`suspended`) and `aadhaar_status`
    (`submitted`/`under_review`/`approved`/`rejected`) — the KYC queue needs
    submitted-but-unreviewed artists.
  - ~10 withdrawal requests (`pending`/`completed`/`rejected`) with wallet
    context.
  - ~12 settlements across `pending`/`processed`/`failed`.
  - ~20 seed audit-log entries (so the page isn't empty before you do
    anything), plus live appends — see §6.
  - Platform settings defaults (markup 30%, GST 5%, min withdrawal ₹1,000,
    insurance-recommended threshold ₹20,000) — real values from the
    Onboarding Guide / SAD, not invented.
- **Analytics series** (`lib/mock-data/admin-analytics.ts`): pre-baked demo
  time-series and breakdowns. Explicitly **not** aggregated from the order
  fixtures — computing meaningful trend charts would require hundreds of
  fake orders, which was explicitly rejected. These are labelled in-code as
  demonstration data. Internally coherent (totals across charts agree with
  each other), just not derived.

## 4. Sections

Grouped sidebar nav, `AdminShell` following the `DashboardShell` /
`AggregatorShell` / `AccountShell` copy-and-adapt precedent (a fourth
independent shell — not a forced generalization of three working ones).

### Overview — `/admin`

KPI tiles (GMV, platform revenue, artist payouts, orders, active artworks,
total users, and the three pending-queue counts), recent-activity feed, and
direct shortcuts into whichever queues have items waiting. Redirects from
`/admin` are unnecessary — this _is_ `/admin`.

### Analytics — `/admin/analytics`

The deep view, Recharts-based (see §5): revenue over time split by
destination (platform / artist / aggregator), order volume, category
performance, artwork status funnel, user growth by role, verification-tier
distribution, top artists and aggregators by revenue. Date-range selector
(30d / 90d / 12m) switching between pre-baked series.

### Moderation — the three approval workflows

- **`/admin/moderation/artworks`** — queue of `pending_approval` artworks.
- **`/admin/moderation/artworks/[artworkId]`** — full review: every image at
  size, complete metadata, artist context (verification tier, prior
  approvals), and the real eligibility checklist from `Artist Complete
workflow.md` (100% handmade · no replicas · no AI/digital prints/NFTs ·
  artist owns all rights · no IP infringement) rendered as a reviewer
  checklist. **Approve** → status becomes `marketplace`. **Reject** →
  requires a reason (free text + common-reason presets), status becomes
  `returned` with the reason recorded.
- **`/admin/moderation/kyc`** — artists with `aadhaar_status` of `submitted`
  or `under_review`. Approve/reject per artist. **Aadhaar numbers are never
  displayed** — masked indicator plus status only, per SAD §8.7 ("only the
  verification status is ever exposed via API, never the raw number"). This
  is a real platform rule, not a UI preference.
- **`/admin/moderation/withdrawals`** — pending `withdraw_requests` with the
  requesting user's wallet balance and bank-account-masked reference.
  Approve/reject.

### Catalog

- **`/admin/artworks`** — every artwork regardless of status, with status
  filter, category filter, search, sort, pagination.
- **`/admin/artworks/[artworkId]`** — admin view of a single artwork: full
  status history timeline, current holder/aggregator, COA/NFC identifiers,
  insurance state, and admin actions (force-delist, feature/unfeature).
- **`/admin/categories`** — CRUD over `artwork_categories` (name + slug),
  with an in-use count per category and a guard against deleting a category
  that still has artworks.

### People

- **`/admin/artists`**, **`/admin/aggregators`**, **`/admin/customers`** —
  one table each (search, status filter, pagination), each row linking to a
  detail page.
- **`/admin/artists/[artistId]`** — profile, verification tier breakdown,
  KYC status, their artworks, wallet/settlement summary, suspend/activate.
- **`/admin/aggregators/[aggregatorId]`** — company profile, current
  holdings, commission earned, suspend/activate.
- **`/admin/customers/[customerId]`** — profile, order history,
  suspend/activate.

### Commerce

- **`/admin/orders`** — all orders, status filter, search, pagination;
  row → detail.
- **`/admin/orders/[orderId]`** — full order: artwork, buyer, delivery
  address, payment reference, status timeline, linked settlement.
- **`/admin/settlements`** — settlement table (artist amount / aggregator
  commission / platform revenue / status), with a detail drawer rather than
  a separate route, and a "retry" action on `failed` rows.

### System

- **`/admin/audit-logs`** — read-only, immutable, filterable by action type,
  entity type, and admin user. Never editable or deletable from the UI —
  the SAD (§8.8) is explicit that no API path exists to mutate audit rows,
  so the UI must not imply one exists.
- **`/admin/reports`** — report generation form (type + date range +
  filters) producing a mock "generated report" row with a download
  affordance; list of previously generated reports.
- **`/admin/settings`** — platform configuration: markup %, GST %, minimum
  withdrawal, insurance-recommended threshold. Changing a value here shows
  its downstream effect (e.g. changing markup % updates a live worked
  example of artist price → customer price), because a settings screen
  where numbers have no visible consequence is untrustworthy.

## 5. Charting

Install **Recharts**. The one existing chart (`features/dashboard/revenue-chart.tsx`,
hand-rolled SVG) stays untouched — this is an addition, not a migration.

Before writing any chart code, load the **`dataviz` skill**; it is explicitly
scoped to exactly this task (chart selection, palette construction, dashboard
layout, stat tiles) and its palette guidance must be reconciled with this
project's existing gold-on-near-black tokens in `app/globals.css` rather than
importing a foreign palette wholesale.

Chart components live in `features/admin/charts/` as thin themed wrappers
(`ChartCard`, plus per-type wrappers) so every chart in the admin section
shares one visual system — axis styling, grid, tooltip, legend, empty state —
instead of each page configuring Recharts independently. All charts must
read colors from the existing CSS custom properties (`--gold`,
`--gold-bright`, `--gold-deep`, `--chart-1..5`, `--muted-foreground`) so they
theme correctly in both light and dark, matching every other surface.

## 6. Actions have consequences

Admin actions must visibly change state within the session, or the console is
a lie. Two mechanisms:

1. **Query-cache mutation** — approving an artwork removes it from the
   moderation queue and flips its status wherever else it appears; approving
   a withdrawal moves it out of the pending queue. Implemented via
   `queryClient.setQueryData` at the call sites, the same pattern the
   Customer Account track established for address CRUD (the mock services
   deliberately don't mutate shared fixture arrays).
2. **Live audit log** — every state-changing admin action (artwork
   approve/reject, KYC approve/reject, withdrawal approve/reject, setting
   change, user suspend/activate, category CRUD) appends an entry to an
   in-memory audit store, so `/admin/audit-logs` shows what you just did on
   top of the ~20 seeded historical entries. This mirrors SAD §8.8's rule
   that every state-changing admin action writes an audit row, and it is the
   single most effective way to make the console feel real without a backend.

A small `useAdminAuditStore` (Zustand) holds session-appended entries, merged
with the seeded fixtures for display. Scoped exception to "server data doesn't
live in Zustand" for the same reason the wishlist store was — there is no
server.

## 7. Tables

Admin tables share one `AdminDataTable` component (`features/admin/`) —
column config, search, status filter, sort, offset pagination (`page` /
`page_size`, matching SAD §9.3's "offset pagination for admin tables where
jump-to-page navigation matters"), empty state, and loading skeleton. Built
once, used by every table section.

Row virtualization (SAD §9.6) is **not** implemented — it exists in the SAD to
handle 10,000-row production tables, and this build's fixture set is dozens of
rows by explicit direction. Adding virtualization for datasets this size would
be complexity with no user-visible benefit. Noted here so its absence reads as
a decision rather than an oversight.

## 8. Verification approach

Same as every prior phase: no automated test suite, no browser/screenshot tool
in this environment. `npx tsc --noEmit`, `eslint`, and `curl` against a
`--webpack` dev server checking status codes and rendered body content. Charts
and interactive table state are client-rendered and cannot be curl-verified
past the loading skeleton — this must be stated plainly in task reports rather
than implied away.

## 9. Explicitly out of scope

- Real backend, real auth, real IP allow-listing or admin credential rotation
  (SAD §8.9) — there is no server to enforce any of it.
- Row virtualization — see §7.
- Editing or deleting audit log entries — deliberately impossible, per §8.8.
- Bulk actions (multi-select approve/reject) — the approval workflows are
  per-item review decisions by design; bulk-approving artwork moderation
  would undercut the eligibility-checklist review this console exists for.
- Email/notification log browsing (`notification_history`/`email_logs`
  tables) — deferred; the audit log covers the "what happened" need for now.
