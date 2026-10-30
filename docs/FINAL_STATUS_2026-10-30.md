# GalleryZone — final status, 2026-10-30

**Start here.** This page covers what was done overnight, how it was tested, what is still open, and what you need to decide. Three companion files carry the detail:

| File | What's in it |
|---|---|
| [`DECISIONS_NEEDED.md`](DECISIONS_NEEDED.md) | Every question for you (D1–D20), each with a recommendation. **Answer these next.** |
| [`SECURITY_REVIEW_AND_RISKS.md`](SECURITY_REVIEW_AND_RISKS.md) | Security findings: 22 fixed, 4 open, accepted residual risks, what was checked and found OK. |
| [`REPOSITORY_AUDIT_2026.md`](REPOSITORY_AUDIT_2026.md) | Milestone 0 baseline: architecture, live hosts, Firebase state, first findings. |

> **Nothing is committed, pushed or deployed.** No production data was changed, no payment was made, no email was sent. All work sits in the local working tree on `main`, ready to go onto a branch and PR (D15).

---

## 1. Status by phase of the master spec

| Phase | Status | Notes |
|---|---|---|
| 0 · Audit, Firebase identity, baseline | **VERIFIED** | Firebase account `galleryzone5@gmail.com` confirmed (Editor on `galleryzone-prod`); rules and indexes match the repo. |
| A · Connections | **PARTIAL / BLOCKED** | Firebase verified. Razorpay, ShipRocket, Cashfree and Resend can't be sandbox-tested: test keys and ShipRocket credentials are missing, and only live Razorpay keys were given (D13, D1, D9). |
| B · Website features | **PARTIAL** | GST/KYC reject fixed end to end; customer bank-transfer details removed; onboarding tour (server-saved, versioned, replayable, admin tour added); in-app notifications. **Waiting on decisions:** shipping quote (D1), commission basis (D4), categories (D5), Amazon label (D6), cart (D7), Excel exports (D8). |
| C · Android / Flutter | **PARTIAL** | Flutter installed. Analyze clean, 739/739 tests pass. Demo mode blocked in release builds; dead API call removed. Parity work not started. |
| D · Security | **First pass VERIFIED** | Dedicated review done; P0 and P1 code issues fixed except **D18** (gallery sales credit before money is proven), which needs your decision. |
| E · iOS | NOT STARTED | Needs a Mac, a physical iPhone and an Apple account. |
| F · Store readiness | NOT STARTED | |

---

## 2. What changed tonight

### Money and security fixes (code)
1. **Artists were paid the live price, not the price the buyer paid (P0).** An artist could raise the price between order and payment and be credited the new figure. Orders now snapshot the price at order time, and settlement uses the snapshot.
2. **Placeholder bank account removed from customer checkout (P0)**, web and mobile.
3. **Admin GST/KYC approve and reject work.** They were calling a wrong URL and every click returned 404.
4. **Only the owner can order a physical certificate (P1).** Before, anyone could have one posted to themselves.
5. **Accepting an ownership transfer needs a verified email (P1).** Before, whoever registered the invited address first took the title.
6. **Nobody can mark an order "paid" by hand (P1).** Neither the platform admin's simulate route (in live mode) nor the admin status route can do it now.
7. **The aggregator bank form saves the account number again.** It had been silently dropped.
8. The artist's choice of **marketplace-only / gallery-only** is enforced; ownership can't be transferred while a piece is for sale; **withdrawals need approved KYC**; a holding return racing a sale can't refund twice.
9. **Abuse limits:** paid Cashfree lookups and sign-ups have per-route rate limits; the API read cache has a size cap; API ids containing `/` are refused.
10. **Headers and hardening:** security headers on the website and the API; the Amazon lookup checks every redirect hop; stale or replayed DigiLocker webhooks are ignored.
11. **Dependencies:** critical and high production CVEs patched within the current major versions.

### Features
- **GST/KYC:** the rejection reason is stored and shown to the applicant; a second rejection is no longer silently left unsent.
- **Onboarding tour:** completion is saved on the account per tour version, so a second device doesn't replay it and a revised tour shows once. "Replay the tour" is on every Support page and in the admin top bar. **Admin tour added.**
- **In-app notifications:** every transactional email also lands in a persistent inbox behind the bell on all four portals. It is written before the email is sent, deduped, and supports read/unread, mark-all-read and deep links. *The mobile inbox is not built yet.*

### Guard rails added (so these bugs can't quietly return)
`npm run check` grew from 23 to **31** steps. New:
- `check:checkout`: settlement uses the order snapshot.
- `check:moderation`: the reason reaches the applicant, one email per decision.
- `check:verification`: stale webhook events are ignored.
- `check:notifications`: one per account per event, no un-reading, per-user scope.
- `check:holding-claim`: a holding closes one way only.
- `check:route-param`: path id rules.
- `check:client-routes`: **every web and mobile API call must match a real backend route.** It caught the GST bug and a dead mobile call, and now reports 0 drift.

CI runs these on web and mobile changes too.

---

## 3. How it was tested (every item run twice)

| Suite | Result |
|---|---|
| Backend `npm run check` (31 steps incl. `tsc -b` + API build) | **PASS ×2** |
| Web `next build` (clean `.next`) | **PASS ×2** |
| Web type-check `tsc --noEmit` | PASS |
| Flutter `flutter analyze` | **No issues ×2** |
| Flutter `flutter test` | **739/739 ×2** (one test updated: it asserted a mobile call to an API route that doesn't exist) |
| Playwright smoke | PASS (a known screenshot flake predates this work) |
| Playwright functional suite (129 tests, stubbed API) | **See §5: already unreliable before tonight's changes.** It fails **more** tests on the untouched code (49) than with tonight's changes (41), and the failing tests change from run to run. Every test that failed only with the changes passes on its own, twice. The suite needs its own fix. |
| New money and security checks | Confirmed to **fail on the old code** where practical (moderation, client-routes). |
| Firebase (read-only) | Identity, project, apps, IAM, auth domains, rules, indexes and billing checked twice, identical both times. |

**Not tested:** anything against a running API with real Firestore (no Admin SDK key or staging project, D14); any payment, shipping or email provider in sandbox (no test keys); physical NFC; iOS.

---

## 4. Your morning checklist

1. **Rotate the secrets pasted in chat** (Razorpay live secret and webhook secret, Resend, S3, Cashfree), and later revoke the Firebase CI token (D13).
2. **Razorpay / Cashfree dashboards:** confirm the webhook URLs point at `gz-web-production.up.railway.app`, not the dead `api-production-9fd9` host (D2).
3. **Live checkout charges ₹25 delivery.** Decide the stop-gap and the ShipRocket plan (D1).
4. **Gallery sales credit artists before money is proven.** Pick D18. Until then, check remittances before approving artist withdrawals tied to gallery sales.
5. **Firebase is on the free plan with no backups.** Consider Blaze plus backups (D10).
6. Answer D3–D9, D11, D12, D16, D17, D19, D20 in `DECISIONS_NEEDED.md`.
7. Say **"commit"** (D15), and I'll put all of this on a `fix/milestone-0-security` branch and open a PR.

---

## 5. Known issues not caused by tonight's changes

- **The Playwright functional suite is out of date and partly flaky.**
  - With default parallelism, 41–63 of 129 fail, and a different set each run: timeouts against one `next dev` server. With `--workers=2`, a **stable 25 fail** (17 test locations), and **every one of them also fails on the untouched code**.
  - The ones I traced fail because **the tests lag behind deliberate product changes, not because the product is broken**:
    - Sign-out now asks for confirmation (`SignOutDialog`), but the test expects an instant redirect.
    - The public FAQ shows only "General" (client decision, 18 Oct), but the test expects an "Artists" tab.
    - The login tests look for the mock-era "Simulate invalid credentials" and "Demo Artist" controls, which were removed.
  - The rest (checkout wizard, lightbox, mobile nav, MOU signing, collapsed-sidebar logo) look like the same drift after the PR #26 UI rework, but they are not individually confirmed. Treat them as **unverified until someone checks them against the intended UI**.
  - **Action:** rewrite these specs against the current UI, and run Playwright against `next start` (a production build) with 2 workers in CI. Don't use it as a release gate until then.
- `npm ci` in `frontend-web` failed because the lockfile was out of sync. The lockfile is regenerated in this diff.
- Next.js rewrites `frontend-web/AGENTS.md` (one heading) on every dev/build. Ignore it or commit it once.

## 6. Environment changes made on this machine (outside the repo)

- `.env` written at the repo root from your paste (gitignored; never committed).
- Flutter 3.47.9 installed at `C:\Users\laksh\flutter`, so `C:\Users\laksh\flutter\bin` goes on PATH for mobile work. Windows Developer Mode is needed only for Windows-desktop plugin builds.
- Firebase MCP registered for this project only (`~/.claude.json`, local scope; token-based). `MCP_TIMEOUT=60000` set in `~/.claude/settings.json`. Reload the VS Code window to load the Firebase tools.
