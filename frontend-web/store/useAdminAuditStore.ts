import { create } from "zustand";
import type { AuditLogEntry } from "@/types/admin";

// ---------------------------------------------------------------------------
// Session-only audit trail. Every state-changing admin action (artwork
// approve/reject, KYC approve/reject, withdrawal approve/reject, user
// suspend/activate, category CRUD, settings change) appends an entry here, and
// /admin/audit-logs renders these above the ~20 seeded historical entries in
// lib/mock-data/admin.ts. This is what makes the console feel real without a
// backend: what you just did shows up where it should.
//
// Deliberately NOT persisted, unlike store/useWishlistStore.ts. A wishlist
// that survives a reload is a convenience; an audit trail that survives a
// reload but isn't backed by anything real is actively misleading — it would
// claim a permanent record exists when nothing was ever written. Session-only
// is the honest choice, and it matches SAD §8.8's point that audit rows are
// immutable and server-written: this store never edits or deletes, it only
// appends, and neither does the UI expose any way to.
//
// Scoped exception to "server data doesn't live in Zustand" (SAD §5.5), for
// exactly the same reason the wishlist store is one: there is no server.
// ---------------------------------------------------------------------------

interface AdminAuditState {
  entries: AuditLogEntry[]; // session-appended only, newest first
  append: (entry: Omit<AuditLogEntry, "id" | "createdAt">) => void;
}

export const useAdminAuditStore = create<AdminAuditState>((set) => ({
  entries: [],
  append: (entry) =>
    set((state) => ({
      entries: [
        {
          ...entry,
          id: `audit-${crypto.randomUUID()}`,
          createdAt: new Date().toISOString(),
        },
        ...state.entries,
      ],
    })),
}));
