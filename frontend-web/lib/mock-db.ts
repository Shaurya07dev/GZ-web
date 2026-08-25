// Shared fake "database" for every mock service (adminService,
// aggregatorService, artworkService, customerService, orderService,
// artistDashboardService). There is no backend — this is the piece that
// makes mutations survive a refresh and lets artist/admin/customer/
// aggregator portals see the same underlying state instead of each reading
// its own frozen fixture copy. Swapping to a real API later just means
// deleting this file and the getCollection/setCollection calls that use it;
// every service's method signatures stay the same.
const DB_PREFIX = "gz-db-v1:";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Lazily seeds a collection from `seed()` on first read, then always reads
// back whatever was last written (by this tab or another one on the same
// origin, since it's plain localStorage).
//
// Object collections are merged UNDER the seed on the way out, so a field
// added to a seed after someone has already used the site arrives with its
// default instead of `undefined`. Without this, adding one field to a profile
// crashes the page for every existing visitor and nobody else — the server
// renders from a fresh seed and looks fine, the browser reads its stale copy
// and blows up. That is exactly what a missing `coordinatorPhone` did to the
// aggregator profile.
//
// Stored values always win over seed values; only absent keys are filled in.
// Arrays are returned untouched — a stored list is the truth about that list,
// and merging one against a fixture would resurrect deleted rows.
export function getCollection<T>(key: string, seed: () => T): T {
  if (!isBrowser()) return seed();
  const raw = window.localStorage.getItem(DB_PREFIX + key);
  if (raw !== null) {
    try {
      const stored: unknown = JSON.parse(raw);
      return isPlainObject(stored) ? ({ ...seed(), ...stored } as T) : (stored as T);
    } catch {
      // corrupt value — fall through and reseed
    }
  }
  const value = seed();
  window.localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
  return value;
}

export function setCollection<T>(key: string, value: T): T {
  if (isBrowser()) {
    window.localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
  }
  return value;
}
