# GalleryZone — from deployed prototype to product

Audited 2026-09-14 against commit `bc2e686`. Rule for "done": **nothing on a
web page is hardcoded** — every number, name, list and status comes from the
API (or from a CMS/config the API serves). Tick items only when verified live.

Live today: https://gz-web-livid.vercel.app → https://api-production-9fd9.up.railway.app.
Real end-to-end: auth (email/password, Google), marketplace listing + detail,
artist page, orders/addresses, CoA numbering + physical requests + PDF,
ownership transfers + public passport + QR, MOU signing (server-timed).

Still mock: 21 of 26 `services/*.ts`; 62 pages/components import fixture
files directly (`lib/mock-data/*`, `features/**/…-data.ts`, `mock-collections`).

---

## 0. Unblock (days)
- [ ] Promote a real admin (`users/xYVwIZKMHrTPF3aiAeYjRRpCU9d2` → `role: admin`, `status: active`, `roleGrants: ["platform_admin"]`) + a second platform admin (rate-config approval needs two).
- [ ] Seed the first approved rate-config version (propose → approve).
- [ ] Add `gz-web-livid.vercel.app` to Firebase Auth authorized domains.
- [ ] Run the gated verification: approve artwork → certificate issued → checkout → sale-triggered ownership transfer → CoA request/dispatch.
- [ ] Wire the artist-MOU content update (text file pending) and bump `MOU_VERSION`.

## 1. Remove every hardcoded thing on the web pages (2–3 weeks)
Swap each remaining service to the API **and** delete the direct fixture imports in the components that bypass services. Backend routes marked ✅ already exist.

**Artist portal** (`features/dashboard/*`, `dashboard-data.ts`, `CURRENT_ARTIST_*`)
- [ ] `artistDashboardService` — listArtworks ✅, submitArtwork ✅, updateArtwork ✅, markSoldElsewhere ✅, getWallet ✅, listWalletTransactions ✅, requestWithdrawal ✅, requestDeactivation ✅, profile read/update (**backend: no profile write route yet** — PAN, GST, bank, headline/bio/social links, photo).
- [ ] `artistPayoutService`, `artistRatingService`, `artistNetworkService`, `profileStatsService` (**backend: no rating / network / stats routes yet**).
- [ ] Components importing `dashboard-data.ts` / `ARTIST`: dashboard-shell, dashboard-greeting, portfolio-board, orders-table, wallet-overview, revenue-chart, recent-activity-feed, rating-card, verification-progress/detail, artist-analytics-view, artist-settings-view, artist-profile-summary, artist-network-panel, gallery-spaces-table, profile-kyc-form, coa-nfc-board (rows).

**Aggregator portal** (`features/aggregator/*`, `aggregator-data.ts`)
- [ ] `aggregatorService` (inventory ✅, reserve ✅, release ✅, recordSale ✅, collection ✅), `aggregatorSalesService` (sales ✅, remittances ✅, shipment ✅, wallet ✅, gallery spaces ✅), `aggregatorProfileService` (MOU ✅; profile/GSTIN/settings **no route yet**), `aggregatorMessagesService`, `aggregatorSupportService`, `aggregatorSettingsService`.
- [ ] Components: aggregator-shell, activity-feed, analytics-view, expiry-countdown, gallery-spaces-board, sales-table, shipping-table, wallet-overview, aggregator-mobile-bottom-nav.

**Admin portal** (`features/admin/*`, `admin-data.ts`)
- [ ] `adminService` — every route exists ✅ (KPIs, users, artworks, moderation queues, withdrawals, settlements, orders, categories, external fees, deactivation, audit log, reports, rate-config).
- [ ] Charts/analytics currently fixture-driven: revenue-area, growth-line, category-bar, funnel, tier-donut, volume-bar, top-performers, range-selector, analytics-view (**backend: needs an analytics/aggregates endpoint**).
- [ ] order-admin-table, artwork-review-panel, withdrawal-queue-table, `app/admin/page.tsx`.

**Collector account** (`features/account/*`, `account-data.ts`, `mockCustomer`)
- [ ] `customerService.getProfile/updateProfile` (**backend: no customer profile route**), `customerCollectionService` (owned artworks — derive from ownership events; **needs a "my collection" route**), `customerWalletService` ✅, `customerResaleService` ✅, `customerSupportService`, `buyerInviteService` (**no route**).
- [ ] Components: collector-dashboard, collection-board, order-list, resale-view, wallet-overview, physical-coa-request (`mockCustomer`), `app/wishlist` (server-side wishlist instead of localStorage), `app/checkout` (address/pricing from API only).

**Shared / public**
- [ ] `artworkService.list` — move filtering/sorting/pagination server-side (`GET /v1/artworks?category=&medium=&sort=&page=`); drop `lib/mock-data/helpers` import; `marketplace-filters` option lists (categories, mediums, locations) from the API, not constants.
- [ ] `artwork-card`, `site-header` (search suggestions from API), `app/artists` (artist directory route needed), `app/marketplace` page shell, `about-stats-section` (real counts), `artist-story`, `artist-connect-button`, `auth-layout-panel`, `notification-04` (real notifications).
- [ ] `messagesService`, `supportService` ✅ routes exist (artist-scoped; extend to all roles).
- [ ] Content pages (landing journey/ecosystem/FAQ, about, contact, terms, FAQ) — keep as versioned content but serve from one `content/` source or a CMS, not scattered `*-data.ts`; remove placeholder copy/figures.
- [ ] `verifiedArtist`, `socialProofLinks`, `joinedAt`, artist verification tiers: currently defaulted in `lib/api-mappers.ts` — add to the backend DTOs.
- [ ] Delete `lib/mock-collections.ts`, `lib/mock-db.ts`, `lib/mock-utils.ts`, `lib/mock-data/*`, `features/**/*-data.ts` fixtures, `*.check.ts` that test mocks. CI should fail on any import of them.

## 2. Backend features that don't exist yet (3–4 weeks)
- [ ] **Images**: upload pipeline (signed upload → storage → derivatives → `artworks/{id}/images`), admin image moderation. Storage host decision (Supabase Storage / Firebase Storage on Blaze / R2 / Railway bucket).
- [ ] **Payments**: Razorpay order + checkout + signed webhook (`PAYMENTS_MODE=razorpay`), refunds/cancellation, retry on failure.
- [ ] **Payouts**: RazorpayX (or manual bank) settlement to artists/aggregators; today the ledger records, nobody is paid.
- [ ] **Profiles**: artist/aggregator/customer profile write routes; KYC/PAN/GST document upload + review.
- [ ] **Email/notifications**: verification, password reset templates, transfer invites, order/dispatch/payout updates, admin alerts. Notification outbox + a provider (Resend/SES).
- [ ] **Invoices & tax**: GST invoice PDF per order, TDS §194-O flags into reports, aggregator remittance statements.
- [ ] **Scheduled jobs** (no Cloud Functions on Spark): consignment window sweep, reserved-artwork TTL release, settlement initiation, subscription renewal — as a Railway cron service.
- [ ] **Search & catalogue**: server-side filters/sort/pagination, categories/mediums as data, artist directory, full-text search.
- [ ] **Analytics endpoints** for the admin/artist/aggregator dashboards.
- [ ] **Wishlist, notifications, buyer invites, artist network, ratings** routes.
- [ ] **NFC** (plan §12 NTAG 424 DNA SUN verification) — optional for launch; QR-only is fine if stated.

## 3. Production hardening (1–2 weeks)
- [ ] Rate limiting + bot protection on public routes (`/v1/verify`, `/v1/artworks`, auth).
- [ ] Sentry (API + web), structured logs, uptime checks, Railway alerts.
- [ ] Firestore emulator test suite for `packages/db` (deleted in the pivot) + CI for the frontend (lint, build, smoke).
- [ ] Security review: rules re-audit, admin-only routes, secrets rotation (the Admin SDK key has lived in the repo dir), dependency audit (15 vulns reported at build).
- [ ] Backups/export for Firestore; data retention policy.
- [ ] Custom domain (Vercel + `NEXT_PUBLIC_SITE_URL` + `CORS_ORIGINS`), staging environment on both platforms.
- [ ] Performance: image CDN, caching headers, `GET /v1/artworks` N+1 reads (pricing/status per artwork) → denormalise `status`/`displayPrice` on the artwork doc.

## 4. Product / legal / go-to-market
- [ ] MOU content update; terms, privacy, refund/return policy reviewed by counsel; ownership-on-payment reflected in MOU wording.
- [ ] Artist onboarding flow polish (survey → register → KYC → first listing) and admin runbook.
- [ ] SEO metadata/sitemap/OG images from live data; analytics (Vercel/GA).
- [ ] Accessibility pass on the real-data pages; empty/error/loading states everywhere (fixtures hid these).
- [ ] Beta with a handful of vetted artists + real payments in Razorpay test mode first.

Rough effort for a small team: **6–8 weeks to a beta with real payments and no hardcoded data; ~3 months to a confident public launch.**
