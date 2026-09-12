# GalleryZone frontend-web — Route Inventory & UI System

Date: 2026-09-11. Scope: `GalleryZone/frontend-web` (Next.js 16, App Router). 88 page routes found under `app/**/page.tsx`. This is Phase 1 (route inventory) and Phase 2 (UI system) of the responsive-conversion project — read-only investigation, no CSS/component changes made yet.

## Part 1 — UI System Architecture

### Auth model (matters for testing, not just UX)

There is no real backend session. `lib/session.ts` writes a `gz_session` cookie (`artist | aggregator | customer | admin`) and `proxy.ts` (Next 16's renamed `middleware.ts`) guards four prefixes: `/dashboard` (artist), `/aggregator`, `/admin`, `/account` (customer). Visiting a guarded route with no cookie redirects to `/login?next=...`; visiting with the wrong role's cookie bounces to that role's own section home. Every route under those four prefixes therefore needs a cookie set before Playwright can reach it — this is the one shared test helper worth building in Phase 3 (`tests/support/auth.ts`, `context.addCookies([{name: "gz_session", value: role, ...}])`), rather than driving the real login form per test.

### Layout / shell architecture

Four independent top-level shells, one per role, plus the public shell:

- `components/site-header.tsx` + `components/site-footer.tsx` — public pages (`/`, `/marketplace`, `/artists`, legal pages, etc). Header: sticky, `lg:` (1024px) breakpoint splits a horizontal `NavigationMenu` (desktop) from a full-screen `Dialog`-based drawer (mobile), session-aware (shows "My account"/"My dashboard" vs "Sign In").
- `features/dashboard/dashboard-shell.tsx` (artist), `features/aggregator/aggregator-shell.tsx`, `features/account/account-shell.tsx` (customer), `features/admin/admin-shell.tsx` — all four follow the **same pattern**: fixed sidebar (`w-64`), `-translate-x-full` off-canvas on mobile that becomes `lg:translate-x-0` + `lg:sticky`, an icon-only collapse rail on desktop (`lg:w-20`), a sticky topbar (`h-16`) with a `lg:hidden` hamburger. `AdminShell`'s header comment explicitly documents this as **four deliberate parallel copies, not a shared component** — admin's nav is grouped/collapsible (15 sections) where the other three are flat lists, and the author judged a generalized `RoleShell` not worth the risk to three already-shipped portals. **Do not unify these into one component during this project** — that would contradict a documented decision and is out of scope; if the same responsive bug appears in more than one shell, fix it in each shell (still a small diff, just four times).
- `app/(auth)/layout.tsx` → `features/auth/components/auth-layout-panel.tsx` — a two-pane layout (`lg:flex-row`) for login/register/forgot/reset/verify-email.

**Assessment: the nav/shell layer is already responsive-aware**, not a desktop-only design bolted on later. `lg` (1024px) is the load-bearing breakpoint everywhere for the sidebar/drawer split. This means Phase 6's audit should expect most CRITICAL findings inside page *content* (tables, forms, galleries, cards) rather than in global navigation — confirmed already by the tooling-verification pass: `/` had zero horizontal overflow at any of 320–1440px across all three engines.

### Design tokens

Tailwind v4, config lives in `app/globals.css` via `@theme inline` (no `tailwind.config.js`). No `--breakpoint-*` overrides found → standard Tailwind breakpoints apply: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536. Recurring container-padding pattern across every shell: `px-5 sm:px-8 lg:px-10`. Fonts: `Playfair Display` (`--font-display`, headings) + `Inter` (`--font-sans`/body) via `next/font`.

### Component library

`components/ui/*` — shadcn/ui primitives (button, card, dialog, tabs, select, command, navigation-menu, etc.), Radix/base-ui under the hood. `components/shared/*` — cross-role business components (`artwork-card`, `price-tag`, `price-breakdown`, `verified-badge`, `rarity-badge`, `empty-state`, `star-rating`, `gst-number-card`, `sidebar-brand`). `features/*` — one folder per domain (see route tables below), each owning its own page-level components. This structure means Phase 7's "fix the shared component" instruction maps cleanly: a card-grid bug affecting artwork listings is one fix in `components/shared/artwork-card.tsx`, not N page-level fixes.

### Known state (carried over from tooling verification)

`frontend-web/services/*Service.ts` are all mock (`mockDelay`/`mockError`) — every page in this inventory renders from static mock data, not a live API. That's good for test determinism (no network flake) but means loading/error/empty states are whatever the mock is coded to return, not exercised by real failure modes.

---

## Part 2 — Route Inventory

Columns: **Auth** = which `SessionRole` (or "Public") can reach it per `proxy.ts`. **Type** = Static route / Dynamic (has a `[param]` segment).

### Public & Marketing (no auth)

| Route | Purpose | Auth | Key components | Type | Priority |
|---|---|---|---|---|---|
| `/` | Landing/home — hero, identity, ecosystem, journey, early-program, closing CTA, FAQ sections | Public | `features/landing/*` (Hero/Identity/Ecosystem/Journey/EarlyProgram/ClosingCta/Faq sections) | Static | **P0** |
| `/marketplace` | Browse/search/filter all listed artworks | Public | client component, own filter/search state (no URL sync yet) | Static | **P0** |
| `/marketplace/[artworkId]` | Artwork detail — gallery, info panel, buy entry point | Public | `features/marketplace/artwork-gallery`, `artwork-info-panel`, `related-artworks-rail` | Dynamic | **P0** |
| `/artists` | Artist directory/listing | Public | — | Static | P1 |
| `/artists/[artistId]` | Public artist profile | Public | `artist-profile-header` | Dynamic | **P0** |
| `/about` | About / "how it works" (linked from header's Sell-With-Us panel) | Public | `features/about/*` | Static | P1 |
| `/contact` | Contact form | Public | — | Static | P1 |
| `/faq` | FAQ | Public | `features/faq/*` (shared with portal Support pages) | Static | P1 |
| `/artist-survey` | Lead-gen survey for prospective artists, no account needed | Public | `features/artist-survey/*` | Static | P1 |
| `/checkout` | Purchase flow | Public (cart-driven, no login required to start) | `features/checkout/checkout-flow` | Static | **P0** — money path |
| `/verify/[artworkId]` | Public "artwork passport" — authenticity/COA/ownership history | Public | `features/verify/artwork-passport-view` | Dynamic | **P0** — see note below |
| `/transfer/[transferId]` | Accept NFC ownership transfer (initiate → accept flow from the meeting-backlog patent story) | Public | `features/verify/transfer-accept-view` | Dynamic | **P0** — see note below |

**Note on `/verify/[artworkId]` and `/transfer/[transferId]`:** both are reached by scanning an NFC tag or a QR/link physically attached to a piece of art, most plausibly on a phone, standing in front of the artwork or an aggregator's display. These have an unusually high mobile-first likelihood for the whole app and are flagged P0 for that reason even though they read like "detail pages."

### Auth (no session required by definition)

| Route | Purpose | Auth | Key components | Type | Priority |
|---|---|---|---|---|---|
| `/login` | Sign in (role chosen via demo buttons — fake auth) | Public | `features/auth/*` | Static | **P0** |
| `/register` | Sign up, `?role=artist\|aggregator` deep-linked from header | Public | `features/auth/*` | Static | **P0** |
| `/forgot-password` | Password reset request | Public | `features/auth/*` | Static | P1 |
| `/reset-password` | Password reset form | Public | `features/auth/*` | Static | P1 |
| `/verify-email` | Email verification notice | Public | `features/auth/*` | Static | P1 |

### Buyer / Account (`customer` role, prefix `/account`)

| Route | Purpose | Type | Priority |
|---|---|---|---|
| `/account` | Customer dashboard/home | Static | **P0** |
| `/account/orders` | Order history | Static | P1 |
| `/account/orders/[orderId]` | Order detail | Dynamic | P1 |
| `/account/collection` | Owned artworks ("My Collection") | Static | P1 |
| `/account/wishlist` | Saved artworks | Static | P1 |
| `/account/resale` | List an owned piece for resale | Static | P1 |
| `/account/wallet` | Customer wallet | Static | P1 |
| `/account/addresses` | Shipping addresses | Static | P1 |
| `/account/settings` | Account settings | Static | P1 |
| `/account/support` | Support/FAQ panel | Static | P1 |

All under `features/account/*` + `AccountShell`.

### Artist Dashboard (`artist` role, prefix `/dashboard`)

| Route | Purpose | Type | Priority |
|---|---|---|---|
| `/dashboard` | Artist home/overview | Static | **P0** |
| `/dashboard/artworks/upload` | Submit new artwork (image upload + form) | Static | **P0** |
| `/dashboard/artworks` | My Artworks list | Static | P1 |
| `/dashboard/artworks/[artworkId]/edit` | Edit artwork (7-day-or-purchase window rule) | Dynamic | P1 |
| `/dashboard/profile` | Profile & KYC | Static | P1 |
| `/dashboard/portfolio` | Public-facing portfolio builder | Static | P1 |
| `/dashboard/orders` | Orders | Static | P1 |
| `/dashboard/wallet` | Earnings & Wallet | Static | P1 |
| `/dashboard/settlements` | Settlements | Static | P1 |
| `/dashboard/coa-nfc` | COA & NFC management | Static | P1 |
| `/dashboard/analytics` | Analytics | Static | P1 |
| `/dashboard/messages` | Messages | Static | P1 |
| `/dashboard/gallery-spaces` | Aggregator Display listings | Static | P1 |
| `/dashboard/support` | Support | Static | P1 |
| `/dashboard/settings` | Settings (subscription card) | Static | P1 |
| `/dashboard/verification` | Verification status | Static | P1 |

All under `features/dashboard/*` + `DashboardShell`. Nav order above matches the sidebar (`dashboard-shell.tsx:NAV_ITEMS`) — a reasonable proxy for real usage frequency.

### Aggregator Portal (`aggregator` role, prefix `/aggregator`)

| Route | Purpose | Type | Priority |
|---|---|---|---|
| `/aggregator/dashboard` | Aggregator home/overview | Static | **P0** |
| `/aggregator/inventory` | Inventory ("My Inventory") | Static | P1 |
| `/aggregator/inventory/[artworkId]/reserve` | Reserve an artwork for display | Dynamic | P1 |
| `/aggregator/collection` | Held/displayed pieces | Static | P1 |
| `/aggregator/collection/[holdingId]` | Holding detail | Dynamic | P1 |
| `/aggregator/orders` | Orders & Sales | Static | P1 |
| `/aggregator/customers` | Customers | Static | P1 |
| `/aggregator/shipping` | Shipping & Logistics | Static | P1 |
| `/aggregator/settlements` | Settlements | Static | P1 |
| `/aggregator/wallet` | Earnings & Wallet | Static | P1 |
| `/aggregator/analytics` | Analytics | Static | P1 |
| `/aggregator/messages` | Messages | Static | P1 |
| `/aggregator/gallery-spaces` | Display Spaces | Static | P1 |
| `/aggregator/profile` | My Profile | Static | P1 |
| `/aggregator/settings` | Settings | Static | P1 |
| `/aggregator/support` | Support | Static | P1 |

All under `features/aggregator/*` + `AggregatorShell`.

### Admin Console (`admin` role, prefix `/admin`)

Internal staff tool — judged **P2 across the board**: no external/public traffic, used by a small operations team who overwhelmingly work from a desk. Flagging this as a judgment call, not a fact — say so if staff actually triage moderation queues from a phone/tablet and any of these should move to P1.

| Route | Purpose | Type |
|---|---|---|
| `/admin` | Overview | Static |
| `/admin/analytics` | Platform analytics | Static |
| `/admin/moderation/artworks` (+`/[artworkId]`) | Artwork approval queue | Static/Dynamic |
| `/admin/moderation/kyc` | KYC queue | Static |
| `/admin/moderation/gst` | GST queue | Static |
| `/admin/moderation/withdrawals` | Withdrawal approvals | Static |
| `/admin/moderation/external-fees` | Off-platform fees | Static |
| `/admin/moderation/deactivations` | Deactivations | Static |
| `/admin/artworks` (+`/[artworkId]`) | Artwork catalog | Static/Dynamic |
| `/admin/categories` | Categories | Static |
| `/admin/artists` (+`/[artistId]`) | Artist directory | Static/Dynamic |
| `/admin/aggregators` (+`/[aggregatorId]`) | Aggregator directory | Static/Dynamic |
| `/admin/customers` (+`/[customerId]`) | Customer directory | Static/Dynamic |
| `/admin/orders` (+`/[orderId]`) | Orders | Static/Dynamic |
| `/admin/settlements` | Settlements | Static |
| `/admin/audit-logs` | Audit logs | Static |
| `/admin/reports` | Reports | Static |
| `/admin/settings` | Platform settings | Static |

All under `features/admin/*` + `AdminShell`. 21 routes total.

### Legal / static (no auth) — P3

`/privacy`, `/terms`, `/cookies`, `/artist-terms`, `/aggregator-terms` — pure static text via `features/legal/*` (`LegalLayout`, `LegalToc`, `LegalSectionBlock`). Already proven overflow-free and screenshot-stable in the tooling-verification pass (`/privacy` is the current visual-regression baseline route). Low traffic, low risk, cheap to keep correct — P3 rather than skipped.

---

## Priority Summary

| Priority | Count | Definition here |
|---|---|---|
| P0 | 13 | Landing, marketplace browse + detail, artist public profile, checkout, verify/transfer (NFC), login/register, each role's own dashboard home, artwork upload |
| P1 | ~46 | Everything else inside the four authenticated sections, plus about/contact/faq/artists-list/artist-survey/auth secondary pages |
| P2 | 21 | All of `/admin/*` |
| P3 | 5 | Static legal pages |

88 routes total. This split is what Phase 3 (test expansion) and Phase 8 (fix order) will follow: P0 gets full viewport-matrix + visual baseline treatment first, P1 gets representative coverage, P2/P3 get a lighter pass (overflow + smoke only) unless the audit turns up something serious.

---

## Next

Phase 3: build `tests/support/auth.ts` (cookie-based sign-in helper) and expand `tests/responsive/` to the 13 P0 routes at the 11 named viewports, then representative P1 coverage. Holding off on any CSS/component edits until that infrastructure exists and Phase 6's audit is written, per the task's explicit ordering.
