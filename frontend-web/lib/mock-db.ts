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

// Lazily seeds a collection from `seed()` on first read, then always reads
// back whatever was last written (by this tab or another one on the same
// origin, since it's plain localStorage).
export function getCollection<T>(key: string, seed: () => T): T {
  if (!isBrowser()) return seed();
  const raw = window.localStorage.getItem(DB_PREFIX + key);
  if (raw !== null) {
    try {
      return JSON.parse(raw) as T;
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
