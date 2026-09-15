# GalleryZone — from deployed prototype to product

Audited 2026-09-14 against commit `bc2e686`; progress marked 2026-09-16 (commit `2dc3925`). Testing walkthrough: `docs/TESTING_GUIDE.md`. Rule for "done": **nothing on a
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
- [x] Two platform admins exist.
- [x] Rate config v1 approved (2026-09-16).
- [ ] Add `gz-web-livid.vercel.app` to Firebase Auth authorized domains.
- [x] Approve → certificate → marketplace → Razorpay session verified live. Browser-side: pay with the test card → transfer → CoA request (see TESTING_GUIDE).
- [x] Artist MOU v2026.2 generated from `docs/legal/artist-mou-2026.2.txt` (`frontend-web/scripts/gen-mou.mjs`).

## 1. Remove every hardcoded thing on the web pages (2–3 weeks)
Swap each remaining service to the API **and** delete the direct fixture imports in the components that bypass services. Backend routes marked ✅ already exist.

**Artist portal** (`features/dashboard/*`, `dashboard-data.ts`, `CURRENT_ARTIST_*`)
- [x] `artistDashboardService` — fully on the API (artworks, images, wallet, withdrawals, KPIs, activity, orders, settlements projection, penalties, deactivation, profile/KYC/payout account via `/v1/me/profile`). Gallery-spaces table empty until the aggregator flow lands; notification prefs per-browser; profile photo upload still open.
- [x] `profileStatsService` (artist + collector) computed from the API; `artistRatingService` honest zero. Still fixture: `artistNetworkService` (artist-to-artist connections — no routes), `artistPayoutService` helpers (only used by aggregator mock now).
- [x] Artist portal components no longer import fixture values (only type/label constants).

**Aggregator portal** (`features/aggregator/*`, `aggregator-data.ts`)
- [ ] `aggregatorService` (inventory ✅, reserve ✅, release ✅, recordSale ✅, collection ✅), `aggregatorSalesService` (sales ✅, remittances ✅, shipment ✅, wallet ✅, gallery spaces ✅), `aggregatorProfileService` (MOU ✅; profile/GSTIN/settings **no route yet**), `aggregatorMessagesService`, `aggregatorSupportService`, `aggregatorSettingsService`.
- [ ] Components: aggregator-shell, activity-feed, analytics-view, expiry-countdown, gallery-spaces-board, sales-table, shipping-table, wallet-overview, aggregator-mobile-bottom-nav.

**Admin portal** (`features/admin/*`, `admin-data.ts`)
- [x] `adminService` on API: everything except the aggregator portfolio / holding pull-back. Analytics charts computed from real orders/artworks/users.
- [x] Analytics charts derived client-side from admin data (`hooks/useAdminAnalytics`). A server aggregate endpoint becomes worthwhile past a few thousand orders.
- [ ] order-admin-table, artwork-review-panel, withdrawal-queue-table, `app/admin/page.tsx`.

**Collector account** (`features/account/*`, `account-data.ts`, `mockCustomer`)
- [x] Collector: profile (`/v1/me/profile`), collection (`/v1/account/collection`), wallet, resale, support on the API. Still fixture: `buyerInviteService` (partner-gallery buyer claims — aggregator flow).
- [ ] Components: collector-dashboard, collection-board, order-list, resale-view, wallet-overview, physical-coa-request (`mockCustomer`), `app/wishlist` (server-side wishlist instead of localStorage), `app/checkout` (address/pricing from API only).

**Shared / public**
- [x] `artworkService.list` — server-side filter/sort/search/pagination + facets; marketplace filters, quick chips and rank counts all from the API.
- [ ] `artwork-card`, `site-header` (search suggestions from API), `app/artists` (artist directory route needed), `app/marketplace` page shell, `about-stats-section` (real counts), `artist-story`, `artist-connect-button`, `auth-layout-panel`, `notification-04` (real notifications).
- [x] Support tickets + inbox on the API for all portals.
- [ ] Content pages (landing journey/ecosystem/FAQ, about, contact, terms, FAQ) — keep as versioned content but serve from one `content/` source or a CMS, not scattered `*-data.ts`; remove placeholder copy/figures.
- [ ] `verifiedArtist`, `socialProofLinks`, `joinedAt`, artist verification tiers: currently defaulted in `lib/api-mappers.ts` — add to the backend DTOs.
- [ ] Delete `lib/mock-collections.ts`, `lib/mock-db.ts`, `lib/mock-utils.ts`, `lib/mock-data/*`, `features/**/*-data.ts` fixtures, `*.check.ts` that test mocks. CI should fail on any import of them.

## 2. Backend features that don't exist yet (3–4 weeks)
- [x] **Images**: Railway bucket `artwork-images` (sin), presigned PUT → confirm → `artworks/{id}/images`, served via `GET /v1/images/...` immutable. Still to do: admin image moderation, derivatives (next/image covers resizing).
- [x] **Payments**: Razorpay order + Checkout.js + signed verify + signed webhook, `PAYMENTS_MODE=razorpay` live in test mode. Still open: refunds/cancellation flow, live-mode keys after KYC.
- [ ] **Payouts**: RazorpayX (or manual bank) settlement to artists/aggregators; today the ledger records, nobody is paid.
- [ ] **Profiles**: artist/aggregator/customer profile write routes; KYC/PAN/GST document upload + review.
- [x] **Email** via Resend: welcome+verify, password reset, artwork submitted/approved/returned, order paid (buyer+artist), order status, transfer invite, CoA request, withdrawal requested/decided. **Domain galleryzone.art registered — DNS records pending (until then only the owner's inbox receives mail).** In-app notification feed still open.
- [ ] **Invoices & tax**: GST invoice PDF per order, TDS §194-O flags into reports, aggregator remittance statements.
- [ ] **Scheduled jobs** (no Cloud Functions on Spark): consignment window sweep, reserved-artwork TTL release, settlement initiation, subscription renewal — as a Railway cron service.
- [ ] **Search & catalogue**: server-side filters/sort/pagination, categories/mediums as data, artist directory, full-text search.
- [ ] **Analytics endpoints** for the admin/artist/aggregator dashboards.
- [ ] **Wishlist, notifications, buyer invites, artist network, ratings** routes.
- [ ] **NFC** (plan §12 NTAG 424 DNA SUN verification) — optional for launch; QR-only is fine if stated.

## 3. Production hardening (1–2 weeks)
- [x] Rate limiting (20 rps burst / 300 rpm per IP, all routes). Bot protection (Cloudflare/Turnstile) still open.
- [x] Sentry on API (`galleryzone-api`) and web (`javascript-nextjs`). Uptime checks / Railway alerts still open.
- [ ] Firestore emulator test suite for `packages/db` (deleted in the pivot) + CI for the frontend (lint, build, smoke).
- [ ] Security review: rules re-audit, admin-only routes, secrets rotation (the Admin SDK key has lived in the repo dir), dependency audit (15 vulns reported at build).
- [ ] Backups/export for Firestore; data retention policy.
- [ ] Custom domain (Vercel + `NEXT_PUBLIC_SITE_URL` + `CORS_ORIGINS`), staging environment on both platforms.
- [x] Performance: `artworks.listing` projection (status, price, artist, cover, location, size), 60 s API read cache with write invalidation, public Cache-Control headers, boot-time reindex + admin reindex routes. Image CDN = Vercel image optimiser over the immutable API route.

## 4. Product / legal / go-to-market
- [ ] MOU content update; terms, privacy, refund/return policy reviewed by counsel; ownership-on-payment reflected in MOU wording.
- [ ] Artist onboarding flow polish (survey → register → KYC → first listing) and admin runbook.
- [ ] SEO metadata/sitemap/OG images from live data; analytics (Vercel/GA).
- [ ] Accessibility pass on the real-data pages; empty/error/loading states everywhere (fixtures hid these).
- [ ] Beta with a handful of vetted artists + real payments in Razorpay test mode first.

Rough effort for a small team: **6–8 weeks to a beta with real payments and no hardcoded data; ~3 months to a confident public launch.**
