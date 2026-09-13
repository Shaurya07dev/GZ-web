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

The web frontend (`frontend-web`) is now connected to a real NestJS backend API and uses Firebase for authentication and database. Previously, it ran entirely on mock data, but it is now hitting real endpoints for artwork listings, artist profiles, orders, and addresses.

The mobile client is also actively evolving to integrate with these backend services. While some flows may still simulate external gateways (like payments), the core data model and authentication are now live and centralized.

Per-app notes live in `frontend-web/CLAUDE.md` and
`mobile_flutter/NEXT_SESSION_PROMPT.md`.
