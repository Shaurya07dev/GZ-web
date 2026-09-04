# Infra (Terraform) — Phase 0/6

Not started. Needed before this can be written for real (see the plan's
"Things needed from you", items 1-4): GCP org/billing access, Firebase
project decision, `galleryzone.art` registrar + Cloudflare account, GitHub
Actions secrets/Artifact Registry access.

Planned modules once access is confirmed:
- `cloud-sql/` — Postgres 16, `asia-south1`, private-IP only, PITR + 30-day
  backup retention (plan.md §15).
- `cloud-run/` — `apps/api`, `apps/jobs`, min-instances ≥1.
- `secret-manager/` — Razorpay keys, DB credentials, Firebase service
  account.
- `kms/` — NFC (NTAG 424 DNA) signing keys, PII column encryption keys.
- `networking/` — Cloudflare DNS for `galleryzone.art`, rate-limiting rules.
