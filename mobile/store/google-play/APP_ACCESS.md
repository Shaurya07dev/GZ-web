# Play reviewer app-access notes

GalleryZone can be browsed without signing in. Purchases and portal workflows
require an account. Before submission, create durable non-production reviewer
accounts backed by isolated review data and enter them only in Play Console:

| Role | What the reviewer must be able to inspect |
| --- | --- |
| Customer | Checkout up to the Razorpay test handoff, orders, collection, COA/NFC, saved items, support, settings and deletion request |
| Artist | Profile/KYC, MOU, artwork create/edit, certificates/NFC, sales/settlements, blogs, support and settings |
| Aggregator | GSTIN/DigiLocker state, MOU, reservations, holdings, condition reports, shipments, sales/remittance and settings |

Do not use a real person's KYC, Aadhaar, bank account, card, address or phone in
review data. Explain that administration is web-only and provide any Cashfree,
Razorpay or ShipRocket sandbox steps needed to reach gated screens. Confirm each
credential immediately before submission; expired or role-mismatched access is
a common review rejection.
