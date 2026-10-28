# Google Play Data safety draft

Review this against the deployed backend, provider dashboards and final bundle
immediately before answering Play Console. “Collected” below means transmitted
off the device. Service-provider transfers may qualify for Play's sharing
exemptions, but the Console answers must reflect the signed provider terms.

## Top-level answers

- Data collected: **Yes**.
- Data shared with service providers: **Yes**; evaluate Play's service-provider
  exemption for Firebase, Razorpay, Cashfree, ShipRocket, Resend and Sentry.
- Data encrypted in transit: **Yes** for the production configuration; the app's
  production endpoints are HTTPS.
- Account creation: **Yes**.
- Account deletion: **Yes, request-based**. In-app settings submit an authenticated
  request. External URL: `https://www.galleryzone.art/account-deletion`.
- Independent security review: **No claim** until one is completed.

## Data-type inventory

| Play data type | Collected | Typical purpose | Required / optional | Notes |
| --- | --- | --- | --- | --- |
| Name | Yes | Account management, app functionality, fraud prevention | Required for account | Also shipment and agreement identity |
| Email address | Yes | Authentication, account management, developer communications | Required | Firebase Auth and transactional email |
| User IDs | Yes | Authentication, account management, app functionality | Required | Firebase UID and internal record IDs |
| Address | Yes | Order fulfilment and app functionality | Optional until shipping/pickup is needed | Shared with ShipRocket/courier for a shipment |
| Phone number | Yes | Account management, verification and shipping | Required for role/order flows | Shared with courier when needed |
| Other personal info | Yes | Profile, artist/gallery verification and agreements | Optional/role-dependent | Bio, company, PAN/GSTIN, signature, masked Aadhaar evidence |
| User payment info | Yes, via Razorpay | Payment processing and fraud prevention | Required for checkout | GalleryZone does not receive full card details or UPI PIN |
| Purchase history | Yes | Orders, refunds, settlements, support and accounting | Required when transacting | Includes status and gateway references |
| Other financial info | Yes | Payouts, tax and business verification | Artist/partner only | Bank account/IFSC, PAN/GSTIN, settlement records |
| Photos | Yes | Artwork/profile/blog submission and app functionality | Optional/role-dependent | User-selected or captured images |
| Files and documents | Yes | Certificates, signed agreements and provenance | Optional/role-dependent | Includes generated/requested COA and signature image |
| Other user-generated content | Yes | Marketplace, blogs, support and operations | Optional | Artwork descriptions, blogs, condition reports, tickets |
| Customer support | Yes | Support and account deletion | Optional | Ticket subject, message and status |
| App interactions | Limited | App functionality and fraud/operations | Optional | Server-side order/NFC/verification actions; device-only saves/follows are not transmitted |
| Crash logs / diagnostics | Limited | Security and diagnostics | Automatic for relevant server failures | No mobile Sentry SDK; NFC failure reports and server errors can reach Sentry |

## Not currently collected by the mobile app

- Precise or approximate device location.
- Contacts, call logs, SMS or installed-app inventory.
- Advertising ID or other advertising identifiers.
- Health, fitness, browsing-history or search-history data.
- Audio recordings.
- Full Aadhaar number through the app; DigiLocker returns masked verification
  evidence.

## Retention and deletion

The deployed operating process must delete or de-identify account-linked data
after a verified request. Transaction, tax, settlement, provenance, fraud and
dispute records may be retained only for the stated legal/operational need and
period. A support ticket alone is not completion: the team must finish the
deletion and email confirmation.
