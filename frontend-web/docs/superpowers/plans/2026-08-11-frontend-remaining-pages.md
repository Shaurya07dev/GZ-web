# GalleryZone Frontend — Remaining Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every remaining frontend-web page (Auth, Legal, public Marketplace/Artwork/Artist/Verify pages, About/FAQ, and the full Aggregator Portal) as pure UI against a mock service layer — no real backend — following the same architectural conventions the existing landing page and Artist Dashboard already use.

**Architecture:** A shared "Foundation" phase (Phase 0) builds the mock-data types/fixtures, shared display components, new shadcn primitives, and global nav wiring that everything else depends on. Four independent tracks (Auth+Legal, Marketplace Cluster, About+FAQ, Aggregator Portal) build in parallel on top of Foundation — they don't depend on each other, only on Phase 0.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query v5, Zustand v5, React Hook Form + Zod, shadcn (`base-nova` style, `neutral` base color, no class prefix), Tailwind v4, Framer Motion, lucide-react, Sonner (new).

**Source spec:** `frontend-web/docs/superpowers/specs/2026-08-11-frontend-remaining-pages-design.md` — every task below implements a section of that spec; read it for the full rationale.

## Global Constraints

- **No real backend, no automated tests.** Every service function resolves mock fixture data after a fake delay (`mockDelay`/`mockError` from Task 2). Verification for every task is a manual dev-server browser check (`npm run dev`), not a test suite — the project has no test runner configured (`package.json` scripts are only `dev`/`build`/`start`/`lint`).
- **Route structure is flat, not route-grouped**, matching the existing codebase (`app/dashboard/`, not `app/(artist)/dashboard/`). The one exception: `app/(auth)/` **is** a route group, because five sibling routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`) need a shared layout without sharing a URL prefix — route groups are the correct Next.js mechanism for exactly this, and the existing `app/dashboard/layout.tsx` didn't need one only because `/dashboard/*` already shares a URL prefix.
- **Typed routes**: this project uses Next.js 16's generated route types (see `.next/types/routes.d.ts`). Every new page/layout must use `PageProps<'/exact-route'>` / `LayoutProps<'/exact-route'>`, with `params` and `searchParams` accessed as `Promise`s (`const { artworkId } = await props.params`). These types are generated from the routes that actually exist, so a brand-new route's literal type only resolves after its `page.tsx` exists and `next dev` has run once — create the file first, then use the type.
- **Read `node_modules/next/dist/docs/` before writing any page/layout/route-handler code** — this Next.js version has breaking API changes vs. training data, per `AGENTS.md` at the project root. Do not remove the `AGENTS.md` warning block.
- **Design craft is delegated, not pre-specified.** These tasks specify file paths, exact TypeScript types/interfaces, exact content/copy (sourced from the real docs, never invented), and exact states/behavior — but deliberately do not dictate pixel-level JSX/markup. Before writing any page or component's visual implementation, load the project's own `design-taste-frontend` skill (installed at `.claude/skills/design-taste-frontend`) and the `emil-design-eng` skill, and match the existing brand system already established by the landing page and dashboard: dark near-black (`--background: #0b0a08`) + brass gold (`--gold-bright: #e9c57a`) palette, `font-display` (Playfair Display) for headings, `font-sans` (Inter) for body, the existing `--radius`/spacing scale in `app/globals.css`. Do not invent a new visual language.
- **All monetary values are ₹ (INR)**, formatted consistently (e.g. `₹23,400`, no decimals for whole-rupee amounts) — use a single shared `formatINR(amount: number): string` helper (part of Task 3) everywhere a price is rendered, never ad-hoc `toLocaleString` calls.
- **Artist's private `artist_price` is never rendered anywhere in public-facing UI** — only `customer_price` (the +30%+GST public price). This is a real platform rule (SAD §8.7), not a style preference — the mock `Artwork` type should not even carry `artistPrice` as a field consumed by any public/customer-facing component.
- **Forms use `Field`/`Controller`, not `Form`/`FormField`.** This project's shadcn style has no real `form` component (see Task 1's execution note) — build every form with React Hook Form's `Controller` wrapping shadcn's `Field`/`FieldLabel`/`FieldError` primitives instead.
- **Only one `next dev` process can run per checkout at a time** (confirmed empirically — Next 16's Turbopack holds a project-wide lock regardless of `-p` port). If you're one of several agents working in parallel and a dev server refused to start because another is already running, don't fight over the lock: use `curl` against whichever port is already live to check your own routes (Next hot-reloads all agents' file changes into the same running instance), or fall back to `npx tsc --noEmit` plus a manual code read as your verification. Note in your report which verification path you actually used — no browser/screenshot tool has been available to agents so far, so "verify in browser" has in practice meant curl + type-check, not an eyeballed visual check; say so plainly rather than implying a visual check happened when it didn't.
- **Use the Linux Node toolchain, and use `--webpack` for the dev server.** This WSL box's default `npm`/`npx` resolve to a Windows Node install that breaks on this project's paths — prepend `/home/yashm/.nvm/versions/node/v24.19.0/bin` to `PATH` first. Separately, and more importantly: **Turbopack (this project's default dev bundler) has a confirmed, reproducible bug in this environment** — it crashes with `FATAL: ... spawning node pooled process — No such file or directory (os error 2)` while compiling `app/globals.css`, turning every single route into a 500 (verified directly, consistently reproducible, not a flaky one-off, not fixed by adjusting `PATH`). Compiling with webpack instead avoids it entirely and renders correctly. Always start the dev server as `node_modules/.bin/next dev --webpack -p <port>` (or `npm run dev -- --webpack -p <port>`) — never bare `next dev` — for every verification step in every task from here on. Two earlier agents (Tasks 1 and 4) reported clean boots without this flag; that was not a real pass — they didn't hit the bug by chance, most likely due to a caching or timing difference, not because the underlying crash is avoidable without `--webpack`. Do not trust a bare-Turbopack "✓ Ready" as confirmation that pages actually render — always follow up with a `curl` that inspects response status *and* body content, not just that the process started.
- **Commit after every task.** If `git commit` fails with `insufficient permission for adding an object to repository database .git/objects`, this is a known pre-existing environment issue (root-owned `.git/objects` entries) unrelated to your change — stage the work, note the failed commit in your task report, and continue to the next task rather than attempting `sudo`/ownership workarounds yourself.

---

## Phase 0 — Foundation (sequential — must complete before any other task starts)

### Task 1: New shadcn primitives + Sonner toaster

**Files:**
- Create (via CLI, not hand-authored): `components/ui/checkbox.tsx`, `components/ui/field.tsx`, `components/ui/alert.tsx`, `components/ui/sonner.tsx`, `components/ui/dialog.tsx`, `components/ui/accordion.tsx`, `components/ui/skeleton.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: standard shadcn exports for each primitive (e.g. `Checkbox`, `Field`/`FieldLabel`/`FieldDescription`/`FieldError`/`FieldGroup`/`FieldSet`/`FieldContent` (see note below), `Alert`/`AlertTitle`/`AlertDescription`, `Dialog`/`DialogContent`/`DialogTrigger`, `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`, `Skeleton`), plus a mounted `<Toaster />` and `toast` importable anywhere via `import { toast } from "sonner"`.

> **Update from Task 1 execution:** this project's shadcn style (`base-nova`, built on `@base-ui/react`) has **no real `form` registry item** — `npx shadcn add form` is a silent no-op (confirmed: the registry entry for this style is an empty stub). The actual, currently-documented pattern for this style is `Field`/`FieldLabel`/`FieldDescription`/`FieldError`/`FieldGroup`/`FieldSet`/`FieldLegend`/`FieldSeparator`/`FieldContent`/`FieldTitle`, composed directly with React Hook Form's own `Controller` — **not** a `FormField`/`FormControl` context wrapper. Every later task that builds a form (Tasks 7, 8, 9, and the Aggregator dialogs in Tasks 23-24) must use `Controller` + `<Field data-invalid={fieldState.invalid}>` + `<FieldLabel>` + `<FieldError errors={[fieldState.error]}>`, not the classic API. Install `field`, not `form`.

- [ ] **Step 1: Install the primitives via the shadcn CLI**

Run from `frontend-web/`:
```bash
npx shadcn@latest add checkbox field alert sonner dialog accordion skeleton
```
This project already has `components.json` configured (`style: base-nova`, `baseColor: neutral`, no Tailwind prefix) — the CLI will match existing conventions automatically. If the CLI errors or the flag syntax differs from what's shown here, run `npx shadcn@latest add --help` and adjust — this is a newer major version of the `shadcn` package (`^4.16.2`) and syntax may have moved since training data.

- [ ] **Step 2: Wire the Toaster into the root layout**

In `app/layout.tsx`, import and render `<Toaster />` (from `@/components/ui/sonner`) once, inside `<ThemeProvider>`, after `{children}`, so toasts inherit the dark/light theme. Match the existing dark-first theme: pass `theme` from `next-themes`' `useTheme()` if the generated `sonner.tsx` supports it (check the generated file — shadcn's sonner wrapper typically already does this via `next-themes`).

- [ ] **Step 3: Verify**

`npm run dev`, confirm the app still boots and the landing page renders unchanged. Temporarily add a `toast("test")` call behind a button on any page, click it, confirm a toast renders in the gold/dark theme, then remove the temporary test call.

- [ ] **Step 4: Commit**

```bash
git add components/ui/checkbox.tsx components/ui/field.tsx components/ui/alert.tsx components/ui/sonner.tsx components/ui/dialog.tsx components/ui/accordion.tsx components/ui/skeleton.tsx app/layout.tsx
git commit -m "feat: add checkbox/form/alert/sonner/dialog/accordion/skeleton primitives"
```

---

### Task 2: Mock data types, fixtures, and helpers

**Files:**
- Create: `types/artwork.ts`, `types/artist.ts`, `types/aggregator.ts`
- Create: `lib/mock-utils.ts`
- Create: `lib/mock-data/artworks.ts`, `lib/mock-data/artists.ts`, `lib/mock-data/aggregator-holdings.ts`, `lib/mock-data/helpers.ts`

**Interfaces:**
- Consumes: nothing (this is the base layer).
- Produces: every type and fixture-access function listed below — every later task in every track imports from here.

- [ ] **Step 1: Write the shared types**

`types/artwork.ts`:
```ts
export type ArtworkStatus =
  | "draft" | "pending_approval" | "marketplace" | "reserved"
  | "preparing_dispatch" | "in_transit" | "with_aggregator" | "sold"
  | "settlement_complete" | "delivered" | "completed" | "returned";

export type ListingType = "marketplace_only" | "marketplace_and_aggregator";

export interface ArtworkImage {
  url: string;
  thumbnailUrl: string;
  sortOrder: number;
  altText: string;
}

export interface SocialProofLink {
  platform: "instagram" | "youtube" | "x" | "tiktok";
  url: string;
}

export interface ArtworkStatusEvent {
  status: ArtworkStatus;
  changedAt: string; // ISO date
}

// Matches the GET /marketplace list-item shape documented in the SAD (§3.4)
export interface ArtworkSummary {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  verifiedArtist: boolean;
  category: string;
  medium: string;
  customerPrice: number;
  thumbnailUrl: string;
  insured: boolean;
  status: ArtworkStatus;
  listingType: ListingType;
}

export interface Artwork extends ArtworkSummary {
  description: string;
  dimensions: string | null;
  yearCreated: number | null;
  images: ArtworkImage[]; // up to 8, sortOrder 0 = cover
  coaCertificateNumber: string;
  coaIssueDate: string;
  socialProofLinks: SocialProofLink[];
  statusHistory: ArtworkStatusEvent[];
}

export interface ArtworkFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  medium?: string;
  query?: string;
  sortBy?: "newest" | "price_asc" | "price_desc";
}
```

`types/artist.ts`:
```ts
export interface ArtistSocialLink {
  platform: "instagram" | "youtube" | "x" | "tiktok";
  url: string;
}

export interface ArtistVerificationState {
  tier1SocialMedia: boolean;
  tier2ActivePlan: boolean;
  tier3FirstSale: boolean;
}

export interface ArtistProfile {
  id: string;
  name: string;
  bio: string; // sanitized rich text — render through DOMPurify at display time
  profileImageUrl: string;
  verification: ArtistVerificationState;
  socialLinks: ArtistSocialLink[];
}

export function verifiedTierCount(v: ArtistVerificationState): 0 | 1 | 2 | 3 {
  return ([v.tier1SocialMedia, v.tier2ActivePlan, v.tier3FirstSale].filter(Boolean).length) as 0 | 1 | 2 | 3;
}
```

`types/aggregator.ts`:
```ts
export interface AggregatorHolding {
  id: string; // assignment id
  artworkId: string;
  advancePercent: 5 | 3;
  advanceAmount: number;
  displayPrice: number; // aggregator-editable; floor = artwork.customerPrice
  assignedAt: string; // ISO
  expiresAt: string; // assignedAt + 30 days
  status: "reserved" | "sold_pending_settlement";
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
```

- [ ] **Step 2: Write `lib/mock-utils.ts`**

```ts
export function mockDelay<T>(data: T, ms = 600): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export function mockError(message: string, ms = 600): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}
```

- [ ] **Step 3: Write the fixtures**

`lib/mock-data/artists.ts` — export `mockArtists: ArtistProfile[]`, 7 artists covering every verification state: at least one with all three tiers true (Gold), one with only tier1, one with tier1+tier2, one with none true (freshly registered). Bios must be original short paragraphs (2-4 sentences) in the voice of the Onboarding Guide's marketing copy — no lorem ipsum.

`lib/mock-data/artworks.ts` — export `mockArtworks: Artwork[]`, 18 artworks: spread across at least 5 categories (painting, sculpture, photography, printmaking, textile art), spread across all 7 artists, `customerPrice` ranging roughly ₹8,000–₹150,000, at least 2 with `status: "reserved"` and 1 with `status: "sold"` (for the marketplace grid's non-happy-path states, per spec §5), the rest `status: "marketplace"`. Every artwork gets 3–8 `images` entries and non-empty `socialProofLinks`. **Description text must never mention price/valuation** (this is a real platform rule, not just flavor — see spec §5).

`lib/mock-data/aggregator-holdings.ts` — export `mockAggregatorHoldings: AggregatorHolding[]`, 6 holdings referencing `artworkId`s that exist in `mockArtworks` and have `listingType: "marketplace_and_aggregator"`, mixed `advancePercent` (some 5, some 3), `expiresAt` spread from "expires in 2 days" to "expires in 25 days" (for the countdown UI), one already `status: "sold_pending_settlement"`.

- [ ] **Step 4: Write `lib/mock-data/helpers.ts`**

```ts
import type { Artwork, ArtworkFilters, ArtworkSummary } from "@/types/artwork";
import type { ArtistProfile } from "@/types/artist";
import { mockArtworks } from "./artworks";
import { mockArtists } from "./artists";

export function getArtworkById(id: string): Artwork | undefined { /* ... */ }
export function getArtworksByArtist(artistId: string): Artwork[] { /* ... */ }
export function getArtistById(id: string): ArtistProfile | undefined { /* ... */ }
export function toSummary(artwork: Artwork): ArtworkSummary { /* strip detail fields */ }
export function filterArtworks(artworks: Artwork[], filters: ArtworkFilters): Artwork[] { /* category/price/medium/query */ }
export function sortArtworks(artworks: Artwork[], sortBy: ArtworkFilters["sortBy"]): Artwork[] { /* ... */ }
```
Implement each with real logic (straightforward `.filter`/`.sort`/`.find` — no placeholders).

- [ ] **Step 5: Verify**

Add a temporary console.log in any existing page (e.g. `app/page.tsx`) calling `getArtworkById(mockArtworks[0].id)` and confirm it logs a full artwork object in the dev server terminal. Remove the temporary log. Run `npx tsc --noEmit` (or the project's lint) to confirm no type errors.

- [ ] **Step 6: Commit**

```bash
git add types/artwork.ts types/artist.ts types/aggregator.ts lib/mock-utils.ts lib/mock-data/
git commit -m "feat: add mock data types, fixtures, and query helpers"
```

---

### Task 3: Shared display components + wishlist store

**Files:**
- Create: `components/shared/artwork-card.tsx`, `components/shared/artwork-card-skeleton.tsx`, `components/shared/price-tag.tsx`, `components/shared/verified-badge.tsx`, `components/shared/empty-state.tsx`
- Create: `store/useWishlistStore.ts`
- Modify: `lib/utils.ts` (add `formatINR`)

**Interfaces:**
- Consumes: `ArtworkSummary`, `ArtistVerificationState`, `verifiedTierCount` (Task 2).
- Produces:
  - `formatINR(amount: number): string`
  - `<ArtworkCard artwork={ArtworkSummary} />`
  - `<ArtworkCardSkeleton />`
  - `<PriceTag amount={number} className?={string} />`
  - `<VerifiedBadge verification={ArtistVerificationState} size?={"sm"|"md"} />`
  - `<EmptyState icon={LucideIcon} title={string} description={string} action?={ReactNode} />`
  - `useWishlistStore(): { ids: string[]; toggle(artworkId: string): void; has(artworkId: string): boolean }`

- [ ] **Step 1: Add `formatINR` to `lib/utils.ts`**

```ts
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
```

- [ ] **Step 2: Implement `useWishlistStore`**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  ids: string[];
  toggle: (artworkId: string) => void;
  has: (artworkId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (artworkId) =>
        set((state) => ({
          ids: state.ids.includes(artworkId)
            ? state.ids.filter((id) => id !== artworkId)
            : [...state.ids, artworkId],
        })),
      has: (artworkId) => get().ids.includes(artworkId),
    }),
    { name: "gz-wishlist" }
  )
);
```
This is a deliberate, scoped exception to "server data never lives in Zustand" (SAD §5.5) — there is no server yet. It gets replaced by real query/mutation state once a `/wishlist` API exists (see spec §5).

- [ ] **Step 3: Implement `ArtworkCard`, `ArtworkCardSkeleton`, `PriceTag`, `VerifiedBadge`, `EmptyState`**

Each is a small, focused component (SAD §5.2 caps components around 250-300 lines):
- `ArtworkCard`: thumbnail (next/image), title, artist name + `VerifiedBadge` if `verifiedArtist`, `PriceTag`, insured badge if `insured`, wishlist heart button (uses `useWishlistStore`, `e.preventDefault()`/`stopPropagation()` so it doesn't trigger the card's own link navigation), whole card links to `/marketplace/${id}`. If `status !== "marketplace"`, render a status badge ("Reserved"/"Sold") and visually de-emphasize (reduced opacity or grayscale treatment) with the wishlist/navigation still functional (a sold artwork's detail page still exists) — apply the design-taste-frontend/emil-design-eng skills for the actual visual treatment per the Global Constraints.
- `ArtworkCardSkeleton`: same footprint as `ArtworkCard` using the new `Skeleton` primitive, for loading states.
- `PriceTag`: renders `formatINR(amount)`, monospace/tabular-nums for alignment in grids.
- `VerifiedBadge`: uses `verifiedTierCount()` — 0 renders nothing (or is not rendered by the caller), 1-2 renders a subtler "Verified" mark, 3 renders the "Gold ✦ Verified" treatment named in the Onboarding Guide.
- `EmptyState`: centered icon + title + description + optional action slot, reused for "no search results", "no reservations yet", etc. across every track.

- [ ] **Step 4: Verify**

Build a temporary throwaway page (or use the browser console via a quick edit to `app/page.tsx`) rendering `<ArtworkCard artwork={toSummary(mockArtworks[0])} />` and `<ArtworkCardSkeleton />` side by side in both light and dark mode (toggle via the existing `SwitchMode` control). Confirm the wishlist heart toggles and persists across a page refresh (localStorage). Remove the temporary render.

- [ ] **Step 5: Commit**

```bash
git add components/shared/ store/useWishlistStore.ts lib/utils.ts
git commit -m "feat: add shared ArtworkCard/PriceTag/VerifiedBadge/EmptyState and wishlist store"
```

---

### Task 4: Global nav integration + coming-soon stubs

**Files:**
- Modify: `components/site-header.tsx`, `components/site-footer-data.ts`
- Create: `app/account/page.tsx`, `app/checkout/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: working (non-dangling) nav links to every route this plan will create; `/account` and `/checkout` stub pages that later tasks (Auth login redirect, Artwork Detail Buy Now) can link to safely.

- [ ] **Step 1: Fix/extend `site-header.tsx` nav**

The current `NAV_LINKS` includes `/for-artists`, `/for-collectors`, `/for-galleries` — none of these are in scope for this plan (not in the design spec) and will remain dangling; leave them as-is, do not build those pages. Do add nothing new here unless a link this plan creates is missing — cross-check against Task 2's fixtures once Marketplace/About/FAQ exist. (This step may end up being a no-op; confirm rather than assume.)

- [ ] **Step 2: Add the Cookie Policy link to `site-footer-data.ts`**

In the `"COMPANY"` column's `links` array, add `{ label: "Cookie Policy", href: "/cookies" }` immediately after the existing `"Privacy Policy"` entry. `/terms`, `/privacy`, `/faq`, `/marketplace`, `/artists` links already exist in this file (pre-dating this plan) — they will resolve once the corresponding tracks below ship.

- [ ] **Step 3: Build the two coming-soon stubs**

`app/checkout/page.tsx` and `app/account/page.tsx`: minimal, on-brand "coming soon" pages (reuse the dark/gold visual language, not a bare unstyled page) — headline, one sentence explaining checkout/account management isn't live yet, a link back to `/marketplace`. These are real, finished small pages, not literal placeholder text — the spec (§11) explicitly scopes them as the only customer-facing surface in this phase.

- [ ] **Step 4: Verify**

`npm run dev`, click every link in the footer and header; confirm `/cookies`, `/checkout`, `/account` resolve (the others will 404 until their respective tracks below ship — expected at this point in the plan).

- [ ] **Step 5: Commit**

```bash
git add components/site-footer-data.ts app/account/page.tsx app/checkout/page.tsx
git commit -m "feat: add cookie policy footer link and checkout/account stub pages"
```

---

## Phase 1A — Auth + Legal (parallel track, depends only on Phase 0)

### Task 5: Auth Zod schemas + mock auth service

**Files:**
- Create: `features/auth/schemas/auth-schemas.ts`
- Create: `services/authService.ts`
- Create: `hooks/useAuth.ts`

**Interfaces:**
- Consumes: `mockDelay`, `mockError` (Task 2).
- Produces: `loginSchema`, `registerSchema` (+ per-role refinements), `forgotPasswordSchema`, `resetPasswordSchema` (all Zod); `authService.{login,register,forgotPassword,resetPassword,verifyEmail}`; `useLoginMutation`, `useRegisterMutation`, `useForgotPasswordMutation`, `useResetPasswordMutation`, `useVerifyEmailMutation` (all TanStack `useMutation`).

- [ ] **Step 1: Write the schemas**

```ts
import { z } from "zod";

export const roleSchema = z.enum(["artist", "aggregator", "customer"]);
export type Role = z.infer<typeof roleSchema>;

const passwordRule = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Za-z]/, "At least one letter")
  .regex(/[0-9]/, "At least one number");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerBaseSchema = z.object({
  role: roleSchema,
  name: z.string().min(2, "Name is too short"),
  email: z.string().email(),
  phone: z.string().min(10, "Enter a valid phone number"),
  password: passwordRule,
  confirmPassword: z.string(),
  acceptedTerms: z.literal(true, { message: "You must accept the Terms" }),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine(
  (data) => data.role !== "aggregator" || (!!data.companyName && !!data.contactPerson),
  { message: "Company name and contact person are required", path: ["companyName"] }
);
export type RegisterInput = z.infer<typeof registerBaseSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  password: passwordRule,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
```

- [ ] **Step 2: Write the mock service**

`services/authService.ts` — every method takes a validated input plus an optional `simulateError?: boolean` param (the "dev toggle" from spec §3) and returns `mockDelay(...)` on success or `mockError("...")` when `simulateError` is true, with a realistic message per case:
- `login`: error message `"Invalid email or password"`.
- `register`: error message `"That email is already registered"`.
- `resetPassword`: error message `"This reset link has expired. Request a new one."`.
- `verifyEmail`: error message `"This verification link is invalid or has expired."`.

- [ ] **Step 3: Write `hooks/useAuth.ts`** wrapping each service method in `useMutation`, e.g.:
```ts
export function useLoginMutation() {
  return useMutation({ mutationFn: (input: LoginInput & { simulateError?: boolean }) => authService.login(input) });
}
```
One such hook per service method.

- [ ] **Step 4: Verify**

`npx tsc --noEmit` passes. No UI to click through yet — this task is pure logic, verified by the next tasks that consume it.

- [ ] **Step 5: Commit**

```bash
git add features/auth/schemas/auth-schemas.ts services/authService.ts hooks/useAuth.ts
git commit -m "feat: add auth validation schemas and mock auth service"
```

---

### Task 6: AuthLayout shell

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `features/auth/components/auth-layout-panel.tsx`

**Interfaces:**
- Consumes: `mockArtworks` (Task 2, for the rotating showcase imagery).
- Produces: every page in Tasks 7-10 renders inside this layout automatically (it's a Next.js layout, not an imported component).

- [ ] **Step 1: Implement**

`app/(auth)/layout.tsx` — a `LayoutProps<'/login'>`-style component (confirm the exact generated union includes the auth routes after Task 7-10's `page.tsx` files exist; if not yet generated, use `{ children }: { children: React.ReactNode }` and revisit the exact typed signature once routes exist) rendering a two-column shell: left column renders `<AuthLayoutPanel />`, right column renders `{children}` centered.

`features/auth/components/auth-layout-panel.tsx` — dark branded panel: GZ wordmark (reuse the same markup pattern as `DashboardShell`'s sidebar header), a rotating/auto-advancing showcase of 3-4 `mockArtworks` thumbnails (Framer Motion crossfade, matching `lib/motion-config.ts` conventions already used on the landing page), and a pull-quote from the Onboarding Guide ("Verified Authenticity. Physical & Digital Reach."). Collapses to a compact top banner (no rotating showcase, just wordmark + quote) below the `lg` breakpoint, matching how `DashboardShell`'s sidebar collapses on mobile.

- [ ] **Step 2: Verify**

Temporarily create a throwaway `app/(auth)/test/page.tsx` with `<p>test</p>`, run `npm run dev`, visit `/test`, confirm the split-screen shell renders with the rotating showcase, at both desktop and mobile widths, in both themes. Delete the throwaway page.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/layout.tsx" features/auth/components/auth-layout-panel.tsx
git commit -m "feat: add split-screen AuthLayout shell"
```

---

### Task 7: Register page

**Files:**
- Create: `app/(auth)/register/page.tsx`
- Create: `features/auth/components/role-select-cards.tsx`, `features/auth/components/register-form.tsx`, `features/auth/data/role-options.ts`

**Interfaces:**
- Consumes: `registerBaseSchema`, `RegisterInput`, `Role`, `useRegisterMutation` (Task 5); `AuthLayout` (Task 6, automatic).
- Produces: working `/register` and `/register?role=<role>` (already linked from shipped header/footer — this is not optional).

- [ ] **Step 1: Write `role-options.ts`**

Three entries (`artist`, `aggregator`, `customer`), each with a label, one-sentence description, and icon, using real language: Artist — "List and sell your original artwork with full price privacy." (Onboarding Guide, "Platform Overview"). Aggregator — "Reserve, display, and distribute verified art through your gallery or space." Customer — "Discover and collect verified original artwork."

- [ ] **Step 2: Implement `RegisterPage`**

`app/(auth)/register/page.tsx` is an async server component using `PageProps<'/register'>`, reads `const { role } = await props.searchParams`, validates it against `roleSchema.safeParse(role)`, and passes `initialRole: Role | undefined` to a client `<RegisterForm initialRole={...} />`. This is required, not optional — `/register?role=artist` is already linked from the shipped `SiteHeader` ("Become an Early Artist") and `SiteFooter` ("Join GalleryZone", "Early Artist Program").

- [ ] **Step 3: Implement `RoleSelectCards`**

Three clickable cards (using `Card` primitive). If `initialRole` was passed in, this step is skipped and the form starts on step 2 pre-selected to that role (but the user can still go back and change it).

- [ ] **Step 4: Implement `RegisterForm`**

React Hook Form + `zodResolver(registerBaseSchema)`. Step 2 fields: name, email, phone, password, confirm password, and — only when `role === "aggregator"` — companyName, contactPerson. Required `acceptedTerms` `Checkbox` with label linking to `/terms` (opens in a new tab: `target="_blank"`). On submit, call `useRegisterMutation`; on success, render an in-place "Check your email" success state (not a route change) with a dev-only button labeled "Dev: skip to email verification" linking to `/verify-email?token=mock`. On error, render the message via a `sonner` `toast.error(...)` and keep the form filled in. Include a small, visually-distinct (dashed border, "DEV" label) toggle that sets `simulateError: true` on the next submit, for demoing the duplicate-email error path.

- [ ] **Step 5: Verify**

`npm run dev`. Visit `/register`, complete each role's flow end to end (including the aggregator-only fields appearing/disappearing). Visit `/register?role=customer` and confirm it starts pre-selected on step 2. Try submitting with mismatched passwords and an already-checked "simulate error" toggle to see both validation and simulated-server error paths. Confirm the T&Cs link opens `/terms` in a new tab (route will 404 until Task 11 — expected at this point).

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/register" features/auth/components/role-select-cards.tsx features/auth/components/register-form.tsx features/auth/data/role-options.ts
git commit -m "feat: add register page with role picker and dynamic form"
```

---

### Task 8: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `features/auth/components/login-form.tsx`

**Interfaces:**
- Consumes: `loginSchema`, `LoginInput`, `useLoginMutation` (Task 5).
- Produces: working `/login`.

- [ ] **Step 1: Implement**

Email/password/remember-me (`Checkbox`) fields via React Hook Form + `zodResolver(loginSchema)`. Below the submit button, a visually-flagged (dashed border, small "Demo" label) role `Select`: "Sign in as: Artist / Aggregator / Customer", defaulting to Artist. Link to `/forgot-password`. On submit: call `useLoginMutation`; on success, `router.push` to `/dashboard` (artist), `/aggregator/dashboard` (aggregator), or `/account` (customer) based on the demo toggle's current value; on error (via the same dev-toggle-triggered simulated path as Register, message "Invalid email or password"), show inline form-level error via `Alert` (not just a toast, since a wrong-credentials error is the primary content of the screen at that moment, not a transient notification).

- [ ] **Step 2: Verify**

`npm run dev`. Log in with the Artist toggle selected, confirm redirect to `/dashboard` (already built, should load normally). Switch the toggle to Aggregator, confirm redirect to `/aggregator/dashboard` (will 404 until Task 21-25 ship — expected at this point). Switch to Customer, confirm redirect to `/account` (built in Task 4, should load). Trigger the simulated error and confirm the inline alert appears.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login" features/auth/components/login-form.tsx
git commit -m "feat: add login page with demo role-based redirect"
```

---

### Task 9: Forgot + Reset password pages

**Files:**
- Create: `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`
- Create: `features/auth/components/forgot-password-form.tsx`, `features/auth/components/reset-password-form.tsx`, `features/auth/components/password-strength-meter.tsx`

**Interfaces:**
- Consumes: `forgotPasswordSchema`, `resetPasswordSchema`, `useForgotPasswordMutation`, `useResetPasswordMutation` (Task 5).
- Produces: working `/forgot-password` and `/reset-password?token=...`.

- [ ] **Step 1: Implement `ForgotPasswordForm`**

Single email field. On submit (regardless of whether the email "exists" — there's no real backend to know), swap in-place to a confirmation state: "If an account exists for that email, we've sent a reset link" (deliberately non-committal — this is real security practice, not a mock-phase shortcut, per spec §3). Include a dev-only "Dev: skip to reset form" link to `/reset-password?token=mock`.

- [ ] **Step 2: Implement `PasswordStrengthMeter`**

Small component taking a `password: string` prop, computing a 0-4 strength score from length/character-class checks (reuse the `Progress` primitive already installed, colored via the existing `--chart-1..5` gold-scale tokens rather than a generic red/yellow/green).

- [ ] **Step 3: Implement `ResetPasswordForm`**

`app/(auth)/reset-password/page.tsx` reads `const { token } = await props.searchParams`. If `token` is missing or equals the literal string `"invalid"` (the dev-toggle path), render an error card: "This link is invalid or has expired" + a button back to `/forgot-password`. Otherwise render the form: new password + confirm + `PasswordStrengthMeter`, submit via `useResetPasswordMutation`, success state with a "Continue to Login" button to `/login`.

- [ ] **Step 4: Verify**

`npm run dev`. `/forgot-password` → submit → confirm in-place success swap → follow the dev-skip link → `/reset-password?token=mock` → set a weak then strong password, watch the meter respond → submit → success → "Continue to Login" lands on `/login`. Then visit `/reset-password?token=invalid` directly and confirm the error-card path.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/forgot-password" "app/(auth)/reset-password" features/auth/components/forgot-password-form.tsx features/auth/components/reset-password-form.tsx features/auth/components/password-strength-meter.tsx
git commit -m "feat: add forgot/reset password flow with strength meter"
```

---

### Task 10: Verify-email page

**Files:**
- Create: `app/(auth)/verify-email/page.tsx`
- Create: `features/auth/components/verify-email-status.tsx`

**Interfaces:**
- Consumes: `useVerifyEmailMutation` (Task 5).
- Produces: working `/verify-email?token=...`.

- [ ] **Step 1: Implement**

Page reads `const { token } = await props.searchParams`, passes to a client `<VerifyEmailStatus token={token} />` which fires the mutation on mount (`useEffect`). Three states: "Verifying…" (spinner, ~1.2s via the mock's delay), success (checkmark, "Email verified" + a 3-second countdown auto-redirecting to `/login`, plus a manual "Continue to Login" button for anyone who doesn't want to wait), or failure (when `token === "invalid"`, the dev-toggle path — error icon, "This link is invalid or has expired", "Resend verification email" button that just re-triggers the same mutation).

- [ ] **Step 2: Verify**

`npm run dev`. Visit `/verify-email?token=mock` (reachable via the dev-skip link built in Task 7), confirm the verifying → success → countdown → redirect sequence. Visit `/verify-email?token=invalid` directly, confirm the failure state and that "Resend" re-runs the verifying state.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/verify-email" features/auth/components/verify-email-status.tsx
git commit -m "feat: add verify-email page with success/failure states"
```

---

### Task 11: Legal pages (Terms, Privacy, Cookies)

**Files:**
- Create: `features/legal/legal-layout.tsx`, `features/legal/legal-toc.tsx`
- Create: `features/legal/data/terms-sections.ts`, `features/legal/data/privacy-sections.ts`, `features/legal/data/cookies-sections.ts`
- Create: `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/cookies/page.tsx`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (existing).
- Produces: working `/terms`, `/privacy`, `/cookies` (both already linked from the shipped footer).

- [ ] **Step 1: Implement `LegalLayout` + `LegalToc`**

`LegalLayout`: renders `<SiteHeader />`, a centered `max-w-3xl` article column with a "Last updated: August 2026" line, `{children}`, then `<SiteFooter />`. `LegalToc`: sticky sidebar (desktop only, `lg:` breakpoint) listing section headings with anchor links, built from the same `sections` data each content file exports (each section has `{ id: string; heading: string; body: string[] }`).

- [ ] **Step 2: Write `terms-sections.ts`**

Draft real content, generalized from artist-only to all three roles, from the actual MOU clauses in `Artist Complete workflow.md`:
- "Ownership & Rights" — artist/seller retains ownership of the artwork until a confirmed sale; GalleryZone holds non-exclusive promotion and marketing rights for the duration of an active listing.
- "Exclusivity While Listed" — no listing of the same artwork on another platform while actively listed on GalleryZone.
- "Eligibility" — work must be 100% handmade/original; no replicas, no AI-generated or digital prints, no NFTs; the lister must own all rights and the work must not infringe any third party's IP.
- "Pricing Confidentiality" — the artist's listed price is private; GalleryZone reserves the right to reject or delist artwork at any stage.
- "Termination" — may occur for counterfeit work, false information, IP infringement, or fraud.
- "Governing Law" — governed by the laws of India, with the courts of Hyderabad having exclusive jurisdiction.
- "Changes to These Terms" — amendments must be made in writing and will be posted here with an updated date.
- Plus standard marketplace boilerplate sections: "Accounts", "Payments & Wallet" (settlement timing, withdrawal minimums per the Onboarding Guide), "Limitation of Liability", "Dispute Resolution".

- [ ] **Step 3: Write `privacy-sections.ts`**

Draft fresh (no source document exists), scoped to what the SAD confirms is actually collected (§8.7, §2.4-2.5): "Information We Collect" (KYC/Aadhaar — encrypted at rest, bank account details — stored masked, contact/address details, browsing and wishlist activity); "How We Use It"; "Who We Share It With" (payment gateway, Resend for transactional email, Sentry for error monitoring, HDFC ERGO for opted-in transit insurance); "Data Retention"; "Your Rights" (access/correction/deletion requests); "Contact" (reuse the real contact details from the Onboarding Guide: `galleryzone@zohomail.in`).

- [ ] **Step 4: Write `cookies-sections.ts`**

A short categories table as structured data (`{ category: string; examples: string; purpose: string }[]`) rendered as a real table, not prose: "Essential" (the httpOnly refresh-token session cookie — required, can't be disabled), "Functional" (theme preference, wishlist storage — see Task 3). No analytics cookies exist in this product yet — say so explicitly rather than listing a placeholder category.

- [ ] **Step 5: Implement the three `page.tsx` files** — each is a thin server component rendering `<LegalLayout sections={...}><LegalToc sections={...} />{sections.map(renderSection)}</LegalLayout>`.

- [ ] **Step 6: Verify**

`npm run dev`. Visit all three routes, confirm the desktop TOC scroll-links work, confirm mobile hides the TOC and stacks cleanly, confirm the cookies table actually reads as a table (not a wall of text).

- [ ] **Step 7: Commit**

```bash
git add features/legal/ app/terms app/privacy app/cookies
git commit -m "feat: add Terms/Privacy/Cookies legal pages"
```

---

### Task 12: Cookie consent banner

**Files:**
- Create: `components/cookie-consent-banner.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: a site-wide banner mounted once in the root layout.

- [ ] **Step 1: Implement**

Client component: on mount, check `localStorage.getItem("gz-cookie-consent")`. If unset, render a bottom-anchored bar (not a full-screen modal — this shouldn't block reading the page) with a one-sentence explanation, a link to `/cookies`, and Accept/Dismiss buttons, both of which write to localStorage and hide the banner (only "Accept" vs "Dismiss" differ in stored value, both stop showing it again — there's no cookie-blocking mechanism to actually gate in this mock phase).

- [ ] **Step 2: Mount it** in `app/layout.tsx` alongside the `<Toaster />` from Task 1.

- [ ] **Step 3: Verify**

Clear localStorage, reload any page, confirm the banner appears; click Accept, reload, confirm it stays hidden; clear localStorage again and confirm Dismiss also hides it going forward.

- [ ] **Step 4: Commit**

```bash
git add components/cookie-consent-banner.tsx app/layout.tsx
git commit -m "feat: add cookie consent banner"
```

---

## Phase 1B — Marketplace Cluster (parallel track, depends only on Phase 0)

### Task 13: `artworkService` + query hooks

**Files:**
- Create: `services/artworkService.ts`
- Create: `hooks/useArtworks.ts`, `hooks/useArtwork.ts`, `hooks/useArtistProfile.ts`

**Interfaces:**
- Consumes: `mockArtworks`, `mockArtists`, `getArtworkById`, `getArtworksByArtist`, `getArtistById`, `filterArtworks`, `sortArtworks`, `toSummary`, `mockDelay` (Task 2).
- Produces: `artworkService.{list,get,listByArtist}`, `artistService.get` (small enough to live in the same file), `useArtworks(filters)`, `useArtwork(id)`, `useArtistProfile(id)`, `useArtistArtworks(id)` — all `useQuery`, matching the query-key convention in SAD §5.4 (`['artworks', filters]`, `['artwork', id]`).

- [ ] **Step 1: Implement `artworkService.ts`**

```ts
export const artworkService = {
  list: (filters: ArtworkFilters) => mockDelay(filterArtworks(mockArtworks, filters).map(toSummary).sort(/* per filters.sortBy via sortArtworks first */)),
  get: (id: string) => mockDelay(getArtworkById(id)),
  listByArtist: (artistId: string) => mockDelay(getArtworksByArtist(artistId).map(toSummary)),
};

export const artistService = {
  get: (id: string) => mockDelay(getArtistById(id)),
};
```
(Write the real sort-then-filter composition, not this abbreviated sketch.)

- [ ] **Step 2: Implement the hooks**, each a thin `useQuery` wrapper with the exact query keys above, e.g.:
```ts
export function useArtworks(filters: ArtworkFilters) {
  return useQuery({ queryKey: ["artworks", filters], queryFn: () => artworkService.list(filters) });
}
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` passes. No UI yet — verified by Tasks 14-16.

- [ ] **Step 4: Commit**

```bash
git add services/artworkService.ts hooks/useArtworks.ts hooks/useArtwork.ts hooks/useArtistProfile.ts
git commit -m "feat: add artwork/artist mock services and query hooks"
```

---

### Task 14: Marketplace page

**Files:**
- Create: `app/marketplace/page.tsx`
- Create: `features/marketplace/marketplace-grid.tsx`, `features/marketplace/marketplace-filters.tsx`, `features/marketplace/marketplace-search-bar.tsx`

**Interfaces:**
- Consumes: `useArtworks` (Task 13); `ArtworkCard`, `ArtworkCardSkeleton`, `EmptyState` (Task 3).
- Produces: working `/marketplace`.

- [ ] **Step 1: Implement `MarketplaceFilters`**

Category `Select` (options from the distinct categories present in `mockArtworks`), min/max price number inputs, medium `Select`, sort `Select` (Newest / Price: Low to High / Price: High to Low). Local component state, lifted to the parent page via a callback (no URL query-string sync required for this phase — keep it simple, client state is enough).

- [ ] **Step 2: Implement `MarketplaceSearchBar`** — a debounced (300ms) text input feeding into the same filters state.

- [ ] **Step 3: Implement `MarketplaceGrid`** — takes `filters`, calls `useArtworks(filters)`, renders a responsive grid (2 cols mobile, 3-4 desktop) of `ArtworkCard`s while `isPending` shows 8 `ArtworkCardSkeleton`s, and renders `EmptyState` when the result is empty ("No artworks match your filters" + a "Clear filters" action).

- [ ] **Step 4: Assemble `app/marketplace/page.tsx`** as a client component (needs interactive filter state) composing the three pieces above with `SiteHeader`/`SiteFooter`.

- [ ] **Step 5: Verify**

`npm run dev`. Visit `/marketplace`, confirm all 18 fixture artworks render (some visually marked reserved/sold per Task 2), exercise every filter and the search bar, confirm the empty state appears for an impossible filter combination, confirm sort actually reorders the grid.

- [ ] **Step 6: Commit**

```bash
git add app/marketplace/page.tsx features/marketplace/marketplace-grid.tsx features/marketplace/marketplace-filters.tsx features/marketplace/marketplace-search-bar.tsx
git commit -m "feat: add marketplace browse page with filters, search, and sort"
```

---

### Task 15: Artwork Detail page

**Files:**
- Create: `app/marketplace/[artworkId]/page.tsx`
- Create: `features/marketplace/artwork-gallery.tsx`, `features/marketplace/artwork-info-panel.tsx`, `features/marketplace/related-artworks-rail.tsx`

**Interfaces:**
- Consumes: `useArtwork`, `useArtistArtworks`, `useArtistProfile` (Task 13); `ArtworkCard`, `PriceTag`, `VerifiedBadge`, `useWishlistStore` (Task 3); `getArtworksByArtist` (Task 2, for the "more from this artist" rail, excluding the current artwork).
- Produces: working `/marketplace/[artworkId]`.

> **Note from Task 3's execution:** `ArtworkSummary`/`Artwork` only carry `verifiedArtist: boolean`, not the artist's full `ArtistVerificationState` — passing that boolean-derived data into `VerifiedBadge` can only ever render the subtle "at least tier 1" mark, never the full "Gold ✦ Verified" pill. To show the artist's *real* tier on this page, call `useArtistProfile(artwork.artistId)` (Task 13) alongside `useArtwork` and pass its `.verification` into `VerifiedBadge`, not a value synthesized from `verifiedArtist`.

- [ ] **Step 1: Implement `ArtworkGallery`**

Takes `images: ArtworkImage[]`. Large hero image (cover, `sortOrder: 0`) with a thumbnail strip below/beside it; clicking a thumbnail swaps the hero (client component, local `activeIndex` state). Basic zoom-on-hover or click-to-expand (a `Dialog` showing the full-size image) — pick one, both are reasonable; don't build both.

- [ ] **Step 2: Implement `ArtworkInfoPanel`**

Title, artist name (linking to `/artists/[artistId]`) + `VerifiedBadge` fed by `useArtistProfile(artwork.artistId).verification` (see the note above the Interfaces block — not a boolean-synthesized value), metadata table (category/medium/dimensions/year), `PriceTag` with a small "incl. GST" note, insured badge with a tooltip/popover explaining the transit-insurance option (reuse `Onboarding Guide` language: "recommended for artworks valued above ₹20,000, partnered with HDFC ERGO"), description, authenticity block (COA certificate number + issue date, signature/origin statement), social-proof links rendered as icon buttons opening each URL in a new tab, wishlist toggle button (`useWishlistStore`), and a "Buy Now" button linking to `/checkout` (the Task 4 stub — see Global Constraints, checkout itself is out of scope).

- [ ] **Step 3: Implement `RelatedArtworksRail`** — horizontal scroll of up to 4 `ArtworkCard`s from the same artist, excluding the current one; renders nothing if the artist has no other listed work.

- [ ] **Step 4: Assemble the page**

`app/marketplace/[artworkId]/page.tsx`, async server component using `PageProps<'/marketplace/[artworkId]'>`, awaits `params`, and either fetches server-side for the initial render or delegates entirely to a client component using `useArtwork(artworkId)` — follow the SAD §5.6 rendering-strategy guidance ("Server Component initial SEO + Client Component for wishlist/buy interactivity") by rendering the static info server-side where practical and isolating only the interactive pieces (gallery zoom, wishlist button) as client components.

- [ ] **Step 5: Verify**

`npm run dev`. Visit a `marketplace`-status artwork's detail page, click through every image thumbnail, toggle wishlist, open the insurance tooltip, click a social-proof link, click "Buy Now" and confirm it lands on `/checkout`. Then visit a `reserved`/`sold` artwork's detail page directly and confirm it still renders sensibly (no broken "Buy Now" state — decide what that button should say/do when unavailable, e.g. disabled with "No longer available").

- [ ] **Step 6: Commit**

```bash
git add "app/marketplace/[artworkId]" features/marketplace/artwork-gallery.tsx features/marketplace/artwork-info-panel.tsx features/marketplace/related-artworks-rail.tsx
git commit -m "feat: add artwork detail page"
```

---

### Task 16: Artist Public Profile page + Artists directory

**Files:**
- Create: `app/artists/page.tsx`, `app/artists/[artistId]/page.tsx`
- Create: `features/artists/artist-profile-header.tsx`, `features/artists/artist-story.tsx`, `features/artists/artist-card.tsx`

**Interfaces:**
- Consumes: `useArtistProfile`, `useArtistArtworks` (Task 13); `mockArtists` (Task 2); `VerifiedBadge`, `ArtworkCard` (Task 3).
- Produces: working `/artists` and `/artists/[artistId]` (both already linked from the shipped footer's "Artists"/Explore column).

- [ ] **Step 1: Implement `ArtistCard`** (directory grid item) — profile image, name, `VerifiedBadge`, one-line bio excerpt, links to `/artists/[id]`.

- [ ] **Step 2: Implement `app/artists/page.tsx`** — simple responsive grid of `ArtistCard` over all `mockArtists`, reusing `SiteHeader`/`SiteFooter`. This closes the dangling `/artists` link already shipped in `site-footer-data.ts`.

- [ ] **Step 3: Implement `ArtistProfileHeader`** — profile image, name, `VerifiedBadge`, social links as icon buttons.

- [ ] **Step 4: Implement `ArtistStory`**

Renders `artist.bio` through `DOMPurify.sanitize()` before using `dangerouslySetInnerHTML` — this is the one sanctioned exception in the whole app (SAD §8.3), and it must go through the sanitizer even against trusted fixture content, so the pattern is correct when real user-submitted bios arrive later. Install `dompurify` (`npm install dompurify` + `@types/dompurify` if not already present — check `package.json` first, it is not currently a dependency).

- [ ] **Step 5: Assemble `app/artists/[artistId]/page.tsx`**

`PageProps<'/artists/[artistId]'>`, awaits `params`, renders `ArtistProfileHeader`, `ArtistStory`, then a grid of the artist's `ArtworkCard`s (via `useArtistArtworks`), with `EmptyState` if they have none currently listed.

- [ ] **Step 6: Verify**

`npm run dev`. Visit `/artists`, confirm all 7 fixture artists appear with correct verification badges. Click into a Gold-verified artist and an unverified one, confirm the badge and bio render correctly for both, confirm their listed artworks grid matches what Task 2's fixtures assigned them.

- [ ] **Step 7: Commit**

```bash
git add app/artists features/artists/
git commit -m "feat: add artist directory and public profile pages"
```

---

### Task 17: Verify / Artwork Passport page

**Files:**
- Create: `app/verify/[artworkId]/page.tsx`
- Create: `features/verify/artwork-passport-card.tsx`, `features/verify/provenance-timeline.tsx`

**Interfaces:**
- Consumes: `getArtworkById`, `getArtistById` (Task 2).
- Produces: working `/verify/[artworkId]` (also linked from the Artwork Detail page, Task 15).

- [ ] **Step 1: Implement `ArtworkPassportCard`**

A certificate-styled treatment — gold-bordered card, the artwork's cover image, title, artist name, COA certificate number, COA issue date, an authenticity-seal visual motif (reuse the gold radial-glow/line-art pattern already established in `SiteFooter`'s `FooterGlow` for visual continuity rather than inventing a new motif). This page is explicitly meant to feel ceremonial, not like a normal content page (spec §5).

- [ ] **Step 2: Implement `ProvenanceTimeline`**

Renders `artwork.statusHistory` as a vertical timeline (status label + formatted date per entry), oldest first.

- [ ] **Step 3: Assemble the page**

`PageProps<'/verify/[artworkId]'>`, awaits `params`, looks up the artwork and its artist directly (no query hook needed — this is a simple, mostly-static public page; a plain server-side lookup via the Task 2 helpers is sufficient and matches the real endpoint's public/unauthenticated nature). If the artwork doesn't exist, render Next's `notFound()`.

- [ ] **Step 4: Verify**

`npm run dev`. Visit `/verify/[a-real-artwork-id]` directly and via the "This artwork includes a verified digital passport" link from Task 15's Artwork Detail page. Visit `/verify/does-not-exist` and confirm a proper 404, not a crash.

- [ ] **Step 5: Commit**

```bash
git add app/verify features/verify/
git commit -m "feat: add artwork passport verification page"
```

---

## Phase 1C — About & FAQ (parallel track, depends only on Phase 0)

### Task 18: About page

**Files:**
- Create: `app/about/page.tsx`
- Create: `features/about/about-overview-section.tsx`, `features/about/verification-tiers-section.tsx`, `features/about/tech-features-section.tsx`, `features/about/about-data.ts`

**Interfaces:**
- Consumes: `SiteHeader`, `SiteFooter` (existing).
- Produces: working `/about` (already linked extensively from the shipped header/footer, including the `#how-it-works` anchor from `SiteHeader`'s "How It Works" link).

- [ ] **Step 1: Write `about-data.ts`** with real content only, sourced from the Onboarding Guide:
- Overview: "100% Price Privacy" (artist's listed price stays confidential — the public sees only the markup price), "Verified Authenticity", "Physical & Digital Reach" (aggregator network + direct marketplace).
- 3-tier verification, restated for a general audience (not the artist-onboarding-specific phrasing already used in the dashboard's verification pages): Tier 1 Social Media, Tier 2 Active Plan, Tier 3 First Sale → Gold ✦ Verified.
- Tech features teaser: NFC & QR Tagging (lifecycle-tracked digital identity per artwork), AI Search & Chat, Wallet & Auto Notifications.

- [ ] **Step 2: Implement the three sections + assemble the page**, including an element with `id="how-it-works"` on the verification-tiers section (or wherever makes sense) so the header's `/about#how-it-works` anchor link actually lands somewhere meaningful, not just the top of the page.

- [ ] **Step 3: Verify**

`npm run dev`. Visit `/about` directly, then click "How It Works" from the header nav and confirm it scrolls to the right section (not just the page top).

- [ ] **Step 4: Commit**

```bash
git add app/about features/about/
git commit -m "feat: add about page with platform overview and verification explainer"
```

---

### Task 19: FAQ page

**Files:**
- Create: `app/faq/page.tsx`
- Create: `features/faq/faq-tabs.tsx`, `features/faq/faq-data.ts`

**Interfaces:**
- Consumes: `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` (Task 1), `Tabs` (existing primitive).
- Produces: working `/faq` (already linked from the shipped footer's "For Collectors" column).

Note: `features/landing/faq-data.ts` and `faq-section.tsx` already exist for the landing page's own FAQ — this task's `features/faq/faq-data.ts` is a **separate, larger, audience-organized** dataset for the dedicated page, not a duplicate. Do not modify the landing page's existing FAQ section.

- [ ] **Step 1: Write `faq-data.ts`**

Structured as `{ audience: "general" | "artists" | "aggregators" | "buyers"; question: string; answer: string }[]`, at least 4 real questions per audience sourced from documented mechanics:
- General: what is GalleryZone, how is pricing kept private, what does "Verified" mean.
- Artists: the pricing formula (listed price + 30% markup + 5% GST, aggregator gets 20% of the markup), 7-day settlement timing, insurance (recommended above ₹20,000, HDFC ERGO), the 3-tier verification system.
- Aggregators: the reservation/advance-payment flow (5% or 3% advance), the 30-day display window, commission structure.
- Buyers: rights transfer on confirmed delivery (display/reproduce/license/resell), moral rights retained by the artist, resale/secondary-market support for registered customers.

- [ ] **Step 2: Implement `FaqTabs`** — `Tabs` for the 4 audiences, each tab panel an `Accordion` of that audience's Q&As.

- [ ] **Step 3: Assemble the page**, `SiteHeader`/`SiteFooter` + `FaqTabs`.

- [ ] **Step 4: Verify**

`npm run dev`. Visit `/faq`, switch between all 4 tabs, expand/collapse several accordion items, confirm content matches real platform mechanics (spot-check the pricing example against the Onboarding Guide's worked example: ₹30,000 listed → +30% markup → 5% GST on top).

- [ ] **Step 5: Commit**

```bash
git add app/faq features/faq/
git commit -m "feat: add FAQ page with audience-tabbed accordions"
```

---

## Phase 1D — Aggregator Portal (parallel track, depends only on Phase 0)

### Task 20: `aggregatorService` + hooks (including mutations)

**Files:**
- Create: `services/aggregatorService.ts`
- Create: `hooks/useAggregatorInventory.ts`, `hooks/useAggregatorCollection.ts`, `hooks/useAggregatorDashboard.ts`

**Interfaces:**
- Consumes: `mockArtworks`, `mockAggregatorHoldings`, `getArtworkById`, `mockDelay`, `mockError` (Task 2).
- Produces: `aggregatorService.{dashboardSummary, listReservableInventory, listCollection, reserve, recordSale}`; `useAggregatorDashboard()`, `useReservableInventory()`, `useAggregatorCollection()`, `useReserveArtworkMutation()`, `useRecordSaleMutation()`.

- [ ] **Step 1: Implement `aggregatorService.ts`**

- `listReservableInventory`: artworks with `listingType === "marketplace_and_aggregator"` and `status === "marketplace"` that have no active entry in `mockAggregatorHoldings` (i.e., genuinely unclaimed).
- `reserve(artworkId, simulateConflict?: boolean)`: if `simulateConflict`, `mockError("Artwork no longer available")` (this is the real documented 409 case from SAD §3.5, not an invented error); otherwise resolves a new `AggregatorHolding` with `advancePercent` (5 for artworks under some threshold, 3 above — pick and document a simple rule, e.g. 5% under ₹25,000, 3% at or above, since the SAD doesn't specify the exact split rule and one must be chosen for the mock to behave consistently) and `displayPrice` initialized to the artwork's `customerPrice`.
- `listCollection`: returns `mockAggregatorHoldings` joined with their artworks (an `AggregatorHolding & { artwork: ArtworkSummary }` shape).
- `recordSale(payload: RecordSalePayload)`: resolves the matching holding updated to `status: "sold_pending_settlement"`.
- `dashboardSummary`: derives KPIs from `mockAggregatorHoldings` — count of `status: "reserved"` (active reservations), sum of `advanceAmount` isn't right for "commission earned" (that's realized on sale, not reservation) — compute commission earned as 20% of the markup portion (`displayPrice - artwork.customerPrice` proportion, per the Onboarding Guide's "20% of the 30% markup" rule) summed only across `sold_pending_settlement` holdings; pending settlements = count of `sold_pending_settlement` holdings.

- [ ] **Step 2: Implement the hooks** — queries follow the `['aggregator-inventory']`, `['aggregator-collection']`, `['aggregator-dashboard']` key convention; the two mutations invalidate `['aggregator-inventory']`/`['aggregator-collection']` as appropriate on success (reserve moves an item from inventory to collection; recordSale changes an item's status within collection).

- [ ] **Step 3: Verify**

`npx tsc --noEmit` passes.

- [ ] **Step 4: Commit**

```bash
git add services/aggregatorService.ts hooks/useAggregatorInventory.ts hooks/useAggregatorCollection.ts hooks/useAggregatorDashboard.ts
git commit -m "feat: add aggregator mock service and hooks"
```

---

### Task 21: Aggregator layout & shell

**Files:**
- Create: `app/aggregator/layout.tsx`
- Create: `features/aggregator/aggregator-shell.tsx`, `features/aggregator/aggregator-data.ts`

**Interfaces:**
- Consumes: nothing new (mirrors `DashboardShell`'s pattern, does not import from it — see rationale below).
- Produces: shared shell wrapping every page in Tasks 22-24.

- [ ] **Step 1: Implement `AggregatorShell`**

Deliberately a parallel sibling to `features/dashboard/dashboard-shell.tsx`, not a shared/generalized abstraction — `DashboardShell` is currently hardcoded to artist nav items and artist-specific data (per its actual source: `NAV_ITEMS` is a local const, not a prop), and generalizing it into a shared `RoleShell` for two current call sites is more abstraction than the situation warrants (YAGNI) and risks regressing the already-shipped, working Artist Dashboard. Copy `DashboardShell`'s structure (Sidebar + Topbar composition, identical Tailwind classes/tokens for visual consistency) into a new file, then adapt:
- Nav items: Dashboard (`/aggregator/dashboard`), Inventory (`/aggregator/inventory`), Collection (`/aggregator/collection`).
- No "List new artwork" CTA equivalent — aggregators don't create listings.
- Bottom profile card links to nothing special (no verification page for aggregators in this phase) — just show a static aggregator name/avatar from `aggregator-data.ts` (mirroring `dashboard-data.ts`'s `ARTIST` constant pattern with an `AGGREGATOR` constant: company name, contact person, avatar).

- [ ] **Step 2: Implement `app/aggregator/layout.tsx`** — identical one-line pattern to `app/dashboard/layout.tsx`, wrapping `children` in `<AggregatorShell>`.

- [ ] **Step 3: Verify**

Temporarily create `app/aggregator/test/page.tsx`, run `npm run dev`, visit `/aggregator/test`, confirm the shell renders with the three aggregator nav items and correct active-state highlighting. Delete the throwaway page.

- [ ] **Step 4: Commit**

```bash
git add app/aggregator/layout.tsx features/aggregator/aggregator-shell.tsx features/aggregator/aggregator-data.ts
git commit -m "feat: add aggregator portal shell"
```

---

### Task 22: Aggregator Dashboard page

**Files:**
- Create: `app/aggregator/dashboard/page.tsx`
- Create: `features/aggregator/aggregator-kpi-cards.tsx`, `features/aggregator/commission-explainer.tsx`

**Interfaces:**
- Consumes: `useAggregatorDashboard` (Task 20); reuses `features/dashboard/recent-activity-feed.tsx`'s pattern for an activity feed (adapt, don't import — same reasoning as Task 21).

- [ ] **Step 1: Implement `AggregatorKpiCards`** — three cards: Active Reservations, Commission Earned (`PriceTag`), Pending Settlements, following the same visual card pattern as the artist dashboard's `KPICard` (reuse `features/dashboard/kpi-cards.tsx`'s component directly if it's already generic over a metric/label/value — check that file first; only fork a copy if it's hardcoded to artist metrics the way `DashboardShell` is).

- [ ] **Step 2: Implement `CommissionExplainer`** — small info card: "You earn 20% of the 30% markup on every aggregator-assisted sale" with the same worked-example numbers as the Onboarding Guide (₹30,000 listed → ₹9,000 markup → ₹1,800 aggregator share).

- [ ] **Step 3: Implement a simple recent-activity list** for reservation/sale events from `mockAggregatorHoldings`, most recent first.

- [ ] **Step 4: Assemble the page.**

- [ ] **Step 5: Verify**

`npm run dev`. Visit `/aggregator/dashboard`, confirm KPI numbers are internally consistent with what Tasks 23-24's Inventory/Collection pages will show (same underlying fixture data).

- [ ] **Step 6: Commit**

```bash
git add app/aggregator/dashboard features/aggregator/aggregator-kpi-cards.tsx features/aggregator/commission-explainer.tsx
git commit -m "feat: add aggregator dashboard page"
```

---

### Task 23: Aggregator Inventory page

**Files:**
- Create: `app/aggregator/inventory/page.tsx`
- Create: `features/aggregator/reservable-inventory-grid.tsx`, `features/aggregator/reserve-artwork-dialog.tsx`

**Interfaces:**
- Consumes: `useReservableInventory`, `useReserveArtworkMutation` (Task 20); `ArtworkCard`, `EmptyState` (Task 3).

- [ ] **Step 1: Implement `ReservableInventoryGrid`** — grid of reservable artworks (reuse `ArtworkCard`, but each card's action is "Reserve" instead of navigating straight to the detail page — clicking "Reserve" opens `ReserveArtworkDialog` rather than following a link).

- [ ] **Step 2: Implement `ReserveArtworkDialog`**

A `Dialog` showing the artwork summary, its advance-payment amount (computed the same way `aggregatorService.reserve` will compute it), and a Confirm button. On confirm, call `useReserveArtworkMutation`. On success: close the dialog, `toast.success("Artwork reserved")`, and the grid updates (query invalidation from Task 20 removes it from inventory). On the simulated-conflict path (a small dev-only toggle in the dialog, same pattern as Auth): `toast.error("Artwork no longer available")` and close the dialog without removing the card (mirrors the real race-condition UX — someone else got there first).

- [ ] **Step 3: Assemble the page** with `EmptyState` for "No reservable artworks right now" if inventory is empty.

- [ ] **Step 4: Verify**

`npm run dev`. Visit `/aggregator/inventory`, reserve an artwork, confirm it disappears from Inventory and (cross-check) appears in Collection (Task 24). Trigger the simulated conflict and confirm the error toast with the artwork remaining in the grid.

- [ ] **Step 5: Commit**

```bash
git add app/aggregator/inventory features/aggregator/reservable-inventory-grid.tsx features/aggregator/reserve-artwork-dialog.tsx
git commit -m "feat: add aggregator inventory page with reserve flow"
```

---

### Task 24: Aggregator Collection page

**Files:**
- Create: `app/aggregator/collection/page.tsx`
- Create: `features/aggregator/collection-table.tsx`, `features/aggregator/edit-display-price-dialog.tsx`, `features/aggregator/record-sale-dialog.tsx`, `features/aggregator/expiry-countdown.tsx`

**Interfaces:**
- Consumes: `useAggregatorCollection`, `useRecordSaleMutation` (Task 20); `PriceTag`, `formatINR` (Task 3); `RecordSalePayload` (Task 2).

- [ ] **Step 1: Implement `ExpiryCountdown`** — takes `expiresAt: string`, renders a `Progress`-bar-based countdown (elapsed fraction of the 30-day window) plus "X days left" text, visually flagged (e.g. destructive-toned) when under 3 days remain.

- [ ] **Step 2: Implement `EditDisplayPriceDialog`** — `Dialog` with a single price input, client-validated floor at the holding's `artwork.customerPrice` (per the real SAD constraint — an aggregator may raise but never lower the display price), inline error if the entered value is below the floor, no backend call needed beyond updating local state via a simple mutation-like setter (a full mutation hook isn't necessary for this single field — a local `useState` + `useMutation`-style optimistic update in `useAggregatorCollection`'s query cache via `queryClient.setQueryData` is enough; document this choice inline as a comment only if the reasoning is non-obvious at the call site).

- [ ] **Step 3: Implement `RecordSaleDialog`**

Form (React Hook Form + a small local Zod schema matching `RecordSalePayload`): sold price, buyer name/email/phone, delivery address (line1/city/state/pincode), delivery mode (`Select`: courier / self pickup). On submit, `useRecordSaleMutation`; on success, close dialog, `toast.success("Sale recorded")`, and the row updates in place to `"sold_pending_settlement"` (per spec §7 — it must not disappear from the table).

- [ ] **Step 4: Implement `CollectionTable`** — one row per holding: artwork thumbnail+title, display price (click to open `EditDisplayPriceDialog`, disabled once `status === "sold_pending_settlement"`), `ExpiryCountdown` (hidden once sold), status badge, "Record Sale" button (disabled once already sold).

- [ ] **Step 5: Assemble the page** with `EmptyState` for an aggregator with no current holdings.

- [ ] **Step 6: Verify**

`npm run dev`. Visit `/aggregator/collection`, confirm the countdown bars render sensibly against the varied `expiresAt` values seeded in Task 2. Try lowering a display price below the floor and confirm it's rejected; raise it and confirm it's accepted. Record a sale on one holding and confirm its row updates in place (thumbnail/title stay, status changes, price/countdown controls disable) rather than vanishing.

- [ ] **Step 7: Commit**

```bash
git add app/aggregator/collection features/aggregator/collection-table.tsx features/aggregator/edit-display-price-dialog.tsx features/aggregator/record-sale-dialog.tsx features/aggregator/expiry-countdown.tsx
git commit -m "feat: add aggregator collection page with price editing and sale recording"
```

---

## Self-review notes (already applied above)

- **Spec coverage:** every numbered section of the design spec (§3 Auth, §4 Legal, §5 Marketplace cluster, §6 About/FAQ, §7 Aggregator Portal, §8 shared/integration, §9 visual direction, §11 out-of-scope boundaries) maps to at least one task above; the `/artists` directory gap discovered while reading the actual shipped footer code (not originally itemized in the spec) was folded into Task 16 rather than left dangling.
- **Type consistency:** `ArtworkSummary`/`Artwork`/`ArtworkFilters` (Task 2) are the single definitions reused verbatim through Tasks 13-17; `AggregatorHolding`/`RecordSalePayload` (Task 2) reused verbatim through Tasks 20/24; `useWishlistStore`'s shape (Task 3) is consumed identically in Tasks 14/15 with no redefinition.
- **No shared-abstraction overreach:** `AggregatorShell` (Task 21) and any aggregator KPI/activity components explicitly copy-and-adapt from the artist dashboard's existing patterns rather than refactoring shared code the artist dashboard currently depends on — avoids putting already-shipped, working UI at risk for the sake of DRY-ing two call sites.
