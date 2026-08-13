# GalleryZone Frontend — Remaining Pages (Auth, Legal, Public Marketplace Cluster, Aggregator Portal)

Status: Approved for planning
Date: 2026-08-11
Scope owner: frontend-web (Next.js 15/16 App Router)

## 1. Purpose

`frontend-web` currently has a fully-built landing page and a substantially-built
Artist Dashboard, both using static/mock content. Nothing else exists: no auth
screens, no legal pages, no public marketplace/artwork/artist pages, no
verification-passport page, no aggregator portal. `services/`, `hooks/`,
`store/`, and `types/` are empty — there is no data layer at all yet.

This spec covers building all of the above as **pure frontend UI, with no real
backend**. The explicit decision (confirmed with the user) is: no API calls,
no persistence — but built as if a backend existed, so swapping in the real
API later is mechanical, not a rewrite.

Reference documents (all under `markitdown/`):
- `GalleryZone_Software_Architecture_Docume.md` — system architecture, DB
  schema, API contracts, frontend conventions (Ch. 5).
- `Galleryzone Artist Onboarding Guide.md` — pricing formula, verification
  tiers, marketing copy, platform mechanics.
- `Artist Complete workflow.md` — 10-stage artist lifecycle, eligibility
  criteria, legal/MOU clauses (source for Terms content).

Explicitly out of scope for this phase: Customer Account pages
(`/checkout`, `/account/*`), Admin Dashboard (separate app, not in this
repo), and any real backend/API integration.

## 2. Core architecture decision — the mock service layer

Every subsystem below follows the SAD's real data-fetching pattern
(§5.3–5.4: Page → hook (`useX`) → service (`xService.ts`) → TanStack Query)
**except** the service function resolves a fixture after a fake delay instead
of calling axios:

```ts
// services/artworkService.ts (mock phase)
export const artworkService = {
  list: (filters: ArtworkFilters) => mockDelay(filterArtworks(mockArtworks, filters)),
  get: (id: string) => mockDelay(mockArtworks.find(a => a.id === id)),
};

// hooks/useArtworks.ts — identical to what SAD §5.3 specifies for the real thing
export function useArtworks(filters: ArtworkFilters) {
  return useQuery({ queryKey: ['artworks', filters], queryFn: () => artworkService.list(filters) });
}
```

One shared fixture module, `lib/mock-data/`, is the single source of truth:
- `artworks.ts` — ~15-20 artworks spanning categories/mediums/price bands,
  shaped per the SAD's `artworks` table (id, artist_id, title, description,
  category, medium, dimensions, year_created, artist_price [never rendered
  publicly], customer_price, listing_type, insurance_opted, status, images[]).
- `artists.ts` — ~6-8 artist profiles at varying verification tiers (some
  Gold-verified, some partial, some unverified) so the UI has real states to
  show, not just the happy path.
- `aggregatorHoldings.ts` — assignments with advance_percent, display_price,
  assigned_at/expires_at for the Aggregator Portal.

Helper functions (`getArtworkById`, `getArtworksByArtist`, `filterArtworks`)
live alongside the fixtures so pages stay consistent — clicking an artwork
card always lands on a detail page with matching data, and an artist's
profile always shows artworks that actually exist in the shared set.

Components never see a mock/real distinction. When a backend exists, only
the `services/*.ts` bodies change.

## 3. Auth screens

Routes: `app/(auth)/{login,register,forgot-password,reset-password,verify-email}/page.tsx`,
shared `app/(auth)/layout.tsx`.

- **Layout**: split-screen `AuthLayout` — dark branded left panel (GZ
  wordmark, gold accents, rotating mock-artwork showcase, a pull-quote from
  the Onboarding Guide), form card on the right. Collapses to a compact
  branded banner + form on mobile.
- **Register**: role picker first (Artist / Aggregator / Customer cards with
  real copy from the Onboarding Guide), then a dynamic form — shared fields
  (name, email, phone, password, confirm) + role-specific extras (Aggregator:
  company name, contact person). Required T&Cs checkbox linking to `/terms`.
  Submit → simulated delay → "check your email" success screen with a
  dev-only shortcut into `/verify-email?token=mock`.
- **Login**: email/password/remember-me + a visually-flagged dev-only "Demo:
  sign in as Artist/Aggregator/Customer" toggle (no backend means nothing
  else can tell us the role). Submit → simulated delay → redirect to the
  matching dashboard. Customer has no dashboard in this phase, so its
  redirect target is a minimal "coming soon" stub at `/account`.
- **Forgot/Reset password**: email → in-place "check your email" swap
  (never confirms/denies the address exists) → `/reset-password?token=`
  with new-password + confirm + strength indicator → success → "Continue to
  Login." Dev toggles simulate expired/invalid-token error states.
- **Verify email**: auto "verifying…" spinner → success (auto-redirect
  countdown to `/login`, since verifying an email does not itself log the
  user in) or dev-toggleable failure with a resend CTA.
- **Simulated errors** (duplicate email, invalid credentials, expired token)
  are reachable via small dev-only toggles, not magic strings — obviously
  non-production, demoable on demand.

## 4. Legal pages

Routes: `app/(public)/{terms,privacy,cookies}/page.tsx`, shared
`LegalLayout` (centered article, sticky desktop table of contents, reuses
existing `SiteHeader`/`SiteFooter`).

- **Terms** — drafted from the real MOU clauses in `Artist Complete
  workflow.md` (artist owns artwork until sale, GalleryZone's non-exclusive
  promotion rights, no listing elsewhere while actively listed, termination
  for counterfeit/false-info/IP-infringement/fraud, Indian law/Hyderabad
  courts jurisdiction, written-amendment clause), generalized to cover all
  three roles, plus standard marketplace boilerplate (accounts, payments/
  wallet, liability, disputes).
- **Privacy** — drafted fresh (no source material exists) covering what the
  SAD confirms is actually collected: Aadhaar/KYC (encrypted at rest, SAD
  §8.7), bank details (masked), addresses, wishlist/browsing activity — and
  who it's shared with (payment gateway, Resend, Sentry, HDFC ERGO
  insurance).
- **Cookies** — categories table (essential: the httpOnly refresh-token
  session cookie; functional: theme preference) plus a lightweight
  site-wide `CookieConsentBanner` (localStorage-backed, dismissible, links
  to `/cookies`), shown from the root layout.

## 5. Public Marketplace cluster

**Marketplace (`/marketplace`)** — cursor-paginated grid (SAD §9.3),
filter bar (category/price range/medium, backed by the fixture set), full-
text search, sort (Newest, Price: Low→High, Price: High→Low).
`ArtworkCard` (thumbnail, title, artist name + verified badge, ₹ customer
price, insured badge). Skeleton loading states, empty state for no-results.
The fixture set includes a couple of `reserved`/`sold` artworks (grayed
card, status badge, disabled CTA) alongside `marketplace`-status ones, so
the grid isn't exclusively the happy path.

**Artwork Detail (`/marketplace/[artworkId]`)** — up to 8-photo gallery
with zoom/thumbnail strip, metadata table (category/medium/dimensions/year),
price + GST note, description (platform rule: descriptions never mention
valuation — enforce in the fixture copy itself), authenticity block (COA,
signature proof, origin declaration), embedded social-proof video links
(Instagram/YouTube/X/TikTok, per Onboarding Guide), wishlist toggle, and a
Buy Now CTA that — since checkout is explicitly out of scope (§11) —
navigates to the same minimal "coming soon" `/checkout` stub used by the
Customer login redirect, rather than being a dead button. Also links to
`/verify/[artworkId]` and shows a "more from this artist" rail.

**Artist Public Profile (`/artists/[artistId]`)** — profile image, bio
(sanitized rich-text "Story" field — the one `dangerouslySetInnerHTML`
exception per SAD §8.3, run through DOMPurify even against fixture content
as a matter of habit), verified-tier badge with an explanation of what it
means, social links, grid of the artist's marketplace listings (reusing
`ArtworkCard`).

**Verify / Artwork Passport (`/verify/[artworkId]`)** — the page a
physical NFC/QR tag resolves to (public, mirrors `GET /nfc/{artwork_id}`).
Certificate treatment, not a normal content page: artwork image, COA
certificate number, issue date, ownership/provenance timeline (from
`artwork_status_history`), an authenticity-seal visual motif.

**Wishlist state**: tracked client-side only in a `useWishlistStore`
(Zustand) for this mock phase — an explicit, scoped exception to "server
data never lives in Zustand" (SAD §5.5) since there is no server yet. Gets
replaced by real query/mutation state once `/wishlist` exists.

## 6. About & FAQ

**About (`/about`)** — real platform mechanics only, sourced from the
Onboarding Guide: price-privacy model, physical + digital reach, the 3-tier
verification system explained step by step, NFC/AI feature teaser. No
invented team bios or copy not grounded in the source docs.

**FAQ (`/faq`)** — accordion, tabbed by audience (General / Artists /
Aggregators / Buyers) using the already-installed `tabs` primitive.
Content drawn from real mechanics already documented: pricing formula,
7-day settlement, insurance threshold (₹20,000), verification tiers, rights
transfer on delivery, resale/secondary-market support.

## 7. Aggregator Portal (end to end)

Routes: `app/(aggregator)/aggregator/{dashboard,inventory,collection}/page.tsx`,
reusing the existing `DashboardShell`/`Sidebar`/`Topbar` pattern from the
Artist Dashboard (same shell, different nav items and role).

- **Dashboard** — KPI cards (active reservations, commission earned,
  pending settlements), recent activity feed, a commission-rate explainer
  (aggregator earns 20% of the 30% markup, per the Onboarding Guide's
  worked example).
- **Inventory** — browse reservable artworks (`marketplace_and_aggregator`
  listing type, unclaimed). "Reserve" action simulates the advance-payment
  flow (5% or 3% advance per SAD §2.7); a dev-toggleable 409 "Artwork no
  longer available" conflict state is simulated as an error toast, since
  that race condition is a real, documented behavior worth showing.
- **Collection** — current holdings table/grid: editable display price
  (floor-enforced at `customer_price`, matching the SAD constraint that an
  aggregator may raise but never lower it), 30-day expiry countdown/
  progress bar, "Record Sale" action opening a form matching
  `POST /aggregators/sale`'s fields (buyer name/email/phone, delivery
  address, delivery mode). On submit, the item moves from "reserved" to a
  "sold, pending settlement" state within the same table (success toast +
  updated status badge) rather than disappearing, so the aggregator can see
  the outcome of their action.

## 8. Shared component & integration work

- New shadcn primitives to add: `checkbox`, `form`, `alert`, `sonner`,
  `dialog`, `accordion`, `skeleton`.
- New shared components: `ArtworkCard`, `PriceTag`, `VerifiedBadge`,
  `EmptyState`, plus the mock-data helpers in §2.
- `SiteHeader` needs new nav links (Marketplace, About, FAQ).
- `SiteFooter` needs new legal links (Terms, Privacy, Cookies) and FAQ.
- These are edits to existing shared components, not new files — easy to
  forget, called out explicitly so they don't get missed during parallel
  dispatch.

## 9. Visual & motion direction

Auth/Legal/Marketplace/Aggregator all extend the existing brand system
already established by the landing page and dashboard (dark near-black +
brass gold, serif display font for headings, the existing shadcn token
set in `app/globals.css`) rather than introducing a new visual language.
Every page-building agent must load the project's own `design-taste-frontend`
skill (the project-specific anti-slop design skill already installed under
`.claude/skills/`) plus `emil-design-eng` before writing UI code, per the
user's explicit direction, so polish and motion detail stay consistent with
the bar the landing page already set.

## 10. Verification approach

No automated test suite is being written in this phase. Each flow/page is
verified by running the dev server and clicking through every state
(loading, populated, empty, error) in-browser before being marked done —
per the project's `run` skill and standard verification-before-completion
practice.

## 11. Explicitly out of scope

- Any real API integration (all data is mock, per §2).
- Customer Account pages (`/account/orders`, `/account/wishlist`,
  `/account/addresses`, `/account/settings`) — login's dev role toggle for
  "Customer", and the Artwork Detail "Buy Now" CTA, both route to a single
  minimal coming-soon `/checkout` stub only.
- Admin Dashboard — separate app, not present in this repository.
- Automated/unit tests.
- Cleanup of the `*.old-rootowned` leftover directories under `app/` and
  `features/` — noted as dead weight, not touched by this phase.
