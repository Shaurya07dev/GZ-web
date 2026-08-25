# GalleryZone

A marketplace for original artwork, built around one idea: every piece carries a
verifiable identity — who made it, who owns it now, and everywhere it has been.

This is the personal workspace repo. Production lives separately, at
[`galleryzone5-alt/gallery-web`](https://github.com/galleryzone5-alt/gallery-web),
and is deployed to [galleryzone.art](https://www.galleryzone.art).

## What is in here

| Folder | What it is |
|---|---|
| `frontend-web/` | The Next.js marketplace website — the full route surface, and the functional reference the mobile app is built against. |
| `mobile_flutter/` | **The mobile app.** Flutter, Android-first. |
| `mobile/` | An abandoned Expo attempt, kept only for its route audit. Not developed. |

Three portals run on top of the same catalogue: **artists** list and price their
own work, **aggregators** take pieces on display in real galleries, and
**collectors** buy, own and resell them.

## Running it

```bash
# website
cd frontend-web && npm install && npm run dev

# mobile
cd mobile_flutter && flutter pub get && flutter run
```

## State of the build

Both clients are complete as interfaces and run entirely on mock data — there is
no backend yet, and no payment gateway is connected. Everything persists to local
storage, which is enough to walk the whole flow end to end: submit a piece, get it
approved, buy it, watch it ship, settle the artist, resell it.

Per-app notes live in `frontend-web/CLAUDE.md` and
`mobile_flutter/NEXT_SESSION_PROMPT.md`.
