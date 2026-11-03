# Demo data: run the whole product locally with realistic data

A local stack (API + website, optionally the phone app) on **Firebase emulators**, filled with a
complete, believable data set so every screen and every flow can be tested end to end.
It never touches the real project: the seed only talks to the emulators and refuses a non-`demo-*` project id.

## Start it (three terminals, from `backend/` unless noted)

```bash
npm run demo:emulators                      # 1. Firestore :8180 + Auth :9099 (needs Java; data kept in backend/.demo-data)
npm run build                               #    once, and after backend changes
node --env-file=demo.env --experimental-strip-types apps/api/dist/main.js     # 2. API on :8080
npm run demo:seed                           #    fill the emulator (first run only)
cd ../frontend-web && set -a && . ../backend/demo.env && set +a && npx next dev # 3. website on :3000
```

On PowerShell, load `backend/demo.env` into the session before `npx next dev` (the API reads it with `--env-file`).

## Sign in

Every account uses the password **`Demo@12345`**.

| Role | Accounts |
|---|---|
| Admin (all three grants) | `admin@demo.galleryzone.art` |
| Artists (10) | `artist1` … `artist10@demo.galleryzone.art` |
| Aggregators (5) | `aggregator1` … `aggregator5@demo.galleryzone.art` |
| Customers (6) | `customer1` … `customer6@demo.galleryzone.art` |

## What is in it

**Artists** — one per Indian tradition, at different verification stages: KYC/GST approved (1–6, 10), submitted (7, and artist 4's GST),
rejected with a reviewer note (8), nothing submitted (9); artist 6 is a TR partner, artist 10's account is still `pending`.
MOUs are signed for the approved artists and aggregators 1–4; aggregator 5 and artists 7–9 are unsigned so the MOU gate can be tested.

**55 artworks** across every state: draft, pending approval, returned (rejected with a reason), live on the marketplace
(ranks R/U/O/S/G, including a legacy unranked piece that buyers see as General), reserved by a gallery, sold, delivered, and sold elsewhere (with an external-sale fee). NFC tags are
unlinked, linked-unlocked and linked-locked. Categories: painting, printmaking, textile, ceramics, mixed media.

**Aggregators — each at a different point of the 30-day placement**

| Gallery | Where it is |
|---|---|
| 1 Kala Ghar | Day 3 of 30. Priced above GalleryZone's offer (appreciated). |
| 2 Rangmanch | Day 26 of 30 with a pending extension request, plus a piece at day 12. |
| 3 Jaipur Canvas | Sold inside the window: one cash sale awaiting remittance, one courier sale in transit; open and resolved issue reports. |
| 4 Bengal Atelier | Two months complete: window extended once, sold on day 52, delivered, remitted. Also a piece returned unsold. |
| 5 Southern Strokes | Month-2 placement of the piece gallery 4 returned (2% lower price); low wallet; unsigned MOU. |

**Customers** — orders in every status (pending, paid, confirmed, packed, in transit, delivered, cancelled), carts,
an accepted transfer, a pending and a cancelled one, a display loan to a gallery, a resale listing and sale, physical
certificate requests (requested and dispatched), reviews, disputes.

**Money** — wallet top-ups, ledger entries from the real sale flows, withdrawals (pending, completed, rejected),
settlements (pending, processed, failed), reservation intents (needs refund, refunded, expired).

**Admin queues** — blogs (submitted, accepted, rejected), support tickets, messages, artist connections,
deactivation request, audit log; plus the Art Supplies shelf from `scripts/affiliate-products.seed.json`.

## How it is made

`scripts/seed-demo.ts` calls the same backend functions the API uses (submit, approve, reserve, checkout, sale,
withdrawal, transfer…), so the ledger, ownership history, listing projections and NFC state are real. Only dates are
moved back in time (a holding at "day 26" was created 26 days ago); those edits are marked `backdate`. Settlements are written
directly because nothing in the backend creates that read model.

## Revert

| Command | Effect |
|---|---|
| `npm run demo:clear` | Wipes **all** emulator documents and auth users: back to a fresh, empty install. |
| `npm run demo:reseed` | Clear, then seed again (use after changing the seed). |

The emulator holds only what you put there, so clear is exact. Stopping the emulator with Ctrl+C saves its state to
`backend/.demo-data` (git-ignored) and the next start reloads it.

## Phone app (Flutter)

The app reads the same API. On an Android emulator, with the stack above running:

```bash
cd backend && DEMO_IMAGE_BASE=http://10.0.2.2:3000 npm run demo:reseed     # photos the phone can reach
cd mobile && flutter run --dart-define=GZ_API_URL=http://10.0.2.2:8080 --dart-define=GZ_AUTH_EMULATOR=10.0.2.2:9099
```

`GZ_AUTH_EMULATOR` points sign-in at the Auth emulator; unset in every real build.
