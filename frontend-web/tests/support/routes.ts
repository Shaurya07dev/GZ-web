import type { SessionRole } from './auth';

// Shared by the responsive sweep, desktop/mobile visual baselines, and (later)
// the a11y expansion — one route list so they can't drift out of sync with
// ROUTE_INVENTORY.md. Real mock ids ("monsoon-over-madurai", "devika-rao")
// come from lib/mock-data/{artworks,artists}.ts so detail pages render their
// filled state, not a not-found stub. /transfer/[id] is the one exception:
// ownershipTransfersCol is empty by default (lib/mock-collections.ts), so any
// id there legitimately renders the not-found state — still a real state,
// just not the "accepted transfer" one.
export interface RouteSpec {
  name: string;
  path: string;
  role?: SessionRole;
}

export const P0_ROUTES: RouteSpec[] = [
  { name: 'home', path: '/' },
  { name: 'marketplace', path: '/marketplace' },
  { name: 'marketplace-detail', path: '/marketplace/monsoon-over-madurai' },
  { name: 'artist-profile', path: '/artists/devika-rao' },
  { name: 'checkout', path: '/checkout?artworkId=monsoon-over-madurai' },
  { name: 'verify-passport', path: '/verify/monsoon-over-madurai' },
  { name: 'transfer-accept-not-found', path: '/transfer/does-not-exist' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'account-home', path: '/account', role: 'customer' },
  { name: 'artist-dashboard', path: '/dashboard', role: 'artist' },
  { name: 'artist-upload', path: '/dashboard/artworks/upload', role: 'artist' },
  { name: 'aggregator-dashboard', path: '/aggregator/dashboard', role: 'aggregator' },
];

// A bounded sample of P1, not all ~46 — one or two representative content
// pages per portal section plus the plain public marketing pages. Chosen to
// avoid known nondeterminism (admin's relative-timestamp activity feed,
// aggregator's expiry-countdown on collection/holding-detail — see
// RESPONSIVE_AUDIT.md) rather than excluded after the fact. Extend this list
// incrementally; it's the one place that feeds every later phase.
export const P1_SAMPLE_ROUTES: RouteSpec[] = [
  { name: 'artists-list', path: '/artists' },
  { name: 'about', path: '/about' },
  { name: 'faq', path: '/faq' },
  { name: 'account-orders', path: '/account/orders', role: 'customer' },
  { name: 'account-collection', path: '/account/collection', role: 'customer' },
  { name: 'dashboard-artworks', path: '/dashboard/artworks', role: 'artist' },
  { name: 'dashboard-profile', path: '/dashboard/profile', role: 'artist' },
  { name: 'aggregator-inventory', path: '/aggregator/inventory', role: 'aggregator' },
  { name: 'aggregator-orders', path: '/aggregator/orders', role: 'aggregator' },
];

export const IMPORTANT_ROUTES: RouteSpec[] = [...P0_ROUTES, ...P1_SAMPLE_ROUTES];

// The full P1 set from ROUTE_INVENTORY.md (~46 there; 47 enumerated here —
// off-by-one is the inventory's approximate count, not a discrepancy).
// Dynamic-route ids verified to render real (non-not-found) content, not
// guessed: order-monsoon-madurai, monsoon-over-madurai, and hold-devika-1
// are exercised elsewhere already (P0_ROUTES, or the shell fixes' own
// verification); the aggregator reserve/edit pages were spot-checked
// directly (page title + body content, not just HTTP 200) before being
// added here.
export const P1_ROUTES: RouteSpec[] = [
  // Public / marketing
  { name: 'artists-list', path: '/artists' },
  { name: 'contact', path: '/contact' },
  { name: 'about', path: '/about' },
  { name: 'faq', path: '/faq' },
  { name: 'artist-survey', path: '/artist-survey' },
  { name: 'forgot-password', path: '/forgot-password' },
  { name: 'reset-password', path: '/reset-password' },
  { name: 'verify-email', path: '/verify-email' },

  // Buyer / Account (customer)
  { name: 'account-orders', path: '/account/orders', role: 'customer' },
  { name: 'account-order-detail', path: '/account/orders/order-monsoon-madurai', role: 'customer' },
  { name: 'account-collection', path: '/account/collection', role: 'customer' },
  { name: 'account-wishlist', path: '/account/wishlist', role: 'customer' },
  { name: 'account-resale', path: '/account/resale', role: 'customer' },
  { name: 'account-wallet', path: '/account/wallet', role: 'customer' },
  { name: 'account-addresses', path: '/account/addresses', role: 'customer' },
  { name: 'account-settings', path: '/account/settings', role: 'customer' },
  { name: 'account-support', path: '/account/support', role: 'customer' },

  // Artist Dashboard
  { name: 'dashboard-artworks', path: '/dashboard/artworks', role: 'artist' },
  { name: 'dashboard-artwork-edit', path: '/dashboard/artworks/monsoon-over-madurai/edit', role: 'artist' },
  { name: 'dashboard-profile', path: '/dashboard/profile', role: 'artist' },
  { name: 'dashboard-portfolio', path: '/dashboard/portfolio', role: 'artist' },
  { name: 'dashboard-orders', path: '/dashboard/orders', role: 'artist' },
  { name: 'dashboard-wallet', path: '/dashboard/wallet', role: 'artist' },
  { name: 'dashboard-settlements', path: '/dashboard/settlements', role: 'artist' },
  { name: 'dashboard-coa-nfc', path: '/dashboard/coa-nfc', role: 'artist' },
  { name: 'dashboard-analytics', path: '/dashboard/analytics', role: 'artist' },
  { name: 'dashboard-messages', path: '/dashboard/messages', role: 'artist' },
  { name: 'dashboard-gallery-spaces', path: '/dashboard/gallery-spaces', role: 'artist' },
  { name: 'dashboard-support', path: '/dashboard/support', role: 'artist' },
  { name: 'dashboard-settings', path: '/dashboard/settings', role: 'artist' },
  { name: 'dashboard-verification', path: '/dashboard/verification', role: 'artist' },

  // Aggregator Portal
  { name: 'aggregator-inventory', path: '/aggregator/inventory', role: 'aggregator' },
  { name: 'aggregator-inventory-reserve', path: '/aggregator/inventory/monsoon-over-madurai/reserve', role: 'aggregator' },
  { name: 'aggregator-collection', path: '/aggregator/collection', role: 'aggregator' },
  { name: 'aggregator-holding-detail', path: '/aggregator/collection/hold-devika-1', role: 'aggregator' },
  { name: 'aggregator-orders', path: '/aggregator/orders', role: 'aggregator' },
  { name: 'aggregator-customers', path: '/aggregator/customers', role: 'aggregator' },
  { name: 'aggregator-shipping', path: '/aggregator/shipping', role: 'aggregator' },
  { name: 'aggregator-settlements', path: '/aggregator/settlements', role: 'aggregator' },
  { name: 'aggregator-wallet', path: '/aggregator/wallet', role: 'aggregator' },
  { name: 'aggregator-analytics', path: '/aggregator/analytics', role: 'aggregator' },
  { name: 'aggregator-messages', path: '/aggregator/messages', role: 'aggregator' },
  { name: 'aggregator-gallery-spaces', path: '/aggregator/gallery-spaces', role: 'aggregator' },
  { name: 'aggregator-profile', path: '/aggregator/profile', role: 'aggregator' },
  { name: 'aggregator-settings', path: '/aggregator/settings', role: 'aggregator' },
  { name: 'aggregator-support', path: '/aggregator/support', role: 'aggregator' },
];
