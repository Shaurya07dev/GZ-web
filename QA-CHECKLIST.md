# GalleryZone — Manual QA Checklist

**Date**: 2026-11-06
**Branches live**: PR #38, #39 merged. PR #40 pending.
**Staging**: https://gz-web-livid.vercel.app
**Prod backend**: https://gz-web-production.up.railway.app

> Mark each row ✅ (works) / ❌ (broken) / ⚠️ (edge case) / ⏭ (skipped).
> For anything not working, write down: what you clicked, what you expected, what happened.

**Payment test credentials:**
- Razorpay test card: `4111 1111 1111 1111`, any future expiry (e.g. `12/30`), any CVV, any OTP
- UPI: `success@razorpay`

**Test accounts:**
| Role | Email | Password |
|---|---|---|
| Admin | `gz-test-admin@example.com` | `Passw0rd123` |
| Artist | `gz-test-oauth@example.com` | `Passw0rd123` |
| Aggregator | `gz-test-aggregator@galleryzone.art` | `Passw0rd123` |
| Customer | `gz-test-customer@example.com` | `Passw0rd123` |

---

## 1. Public / anonymous (no sign-in)

### 1.1 Landing (/)
- [ ] Page loads within 3 seconds
- [ ] Hero image + headline + CTA buttons render
- [ ] "Explore", "Artists", "Art Supplies", "About", "FAQ" nav links all work
- [ ] "Sell With Us" dropdown opens + both links route correctly
- [ ] "Sign In" button routes to /login
- [ ] Light/dark theme toggle works
- [ ] Footer links all route somewhere (no 404)
- [ ] Cookie banner "Accept" and "Dismiss" both dismiss the banner

### 1.2 Marketplace (/marketplace)
- [ ] Artwork grid renders
- [ ] Each card shows: image (or "Image coming soon"), title, artist, price
- [ ] Clicking a card opens detail at /marketplace/<id>
- [ ] Category pills: only "All" and "Painting" visible (sculpture/digital removed)
- [ ] Sidebar filters: Category, Medium, Rarity, Price all expand
- [ ] Changing a filter updates the grid
- [ ] Sort dropdown switches order
- [ ] Hero search button (top right) opens popover
- [ ] Type "painting" + hit enter → URL changes to ?q=painting + grid filters
- [ ] "Clear all filters" resets everything
- [ ] Empty filter result shows "No artworks" message, not a crash

### 1.3 Artwork detail (/marketplace/<id>)
- [ ] Image(s) show. Carousel arrows work if multiple
- [ ] Price, title, artist name, GST note render
- [ ] "Buy now" button — click as signed-out → routes to /login?next=...
- [ ] "Add to cart" as signed-out → **new** "Sign in to use your cart" toast with Sign in action
- [ ] "Wishlist" button present
- [ ] Artist name is a link → routes to /artists/<id>
- [ ] Verification badge shows if artist verified
- [ ] "View full passport" link routes to /verify/<id>

### 1.4 Artist public profile (/artists/<id>)
- [ ] Artist avatar, name, bio, verification tier render
- [ ] "Browse artworks" grid shows their pieces
- [ ] "Connect" button is **hidden** (was broken, now hidden until wired)
- [ ] Rating + review count visible if present
- [ ] Social links (Instagram etc.) open in new tab

### 1.5 About / FAQ / Blogs (/about, /faq, /blogs)
- [ ] /about scrolls, headings render, team cards present
- [ ] /faq — all collapse/expand on click, categories filter
- [ ] /blogs — grid of blog cards, click opens /blogs/<slug>
- [ ] Each blog post page renders content, no 404

### 1.6 Sign in (/login)
- [ ] Email + password fields present
- [ ] "Remember me" toggle works (persists between refreshes)
- [ ] "Forgot password?" routes to /forgot-password
- [ ] "Google" button present (clicking opens Google popup — expected)
- [ ] Wrong password → actionable toast "Your email or password is wrong… tap Forgot password?"
- [ ] Right credentials sign in and route to role home

### 1.7 Sign up (/register?role=customer)
- [ ] Role picker (Customer/Artist/Aggregator) works
- [ ] Email, password, name, phone, "I agree to the Terms" all present
- [ ] Submit with invalid email → **new** title "Please check 'email' and try again"
- [ ] Valid submit → routes to /onboarding/verify
- [ ] Verify screen shows:
  - [ ] If `EMAIL_FROM` set: 6-digit code arrives in inbox within 10s
  - [ ] If NOT set: **new** persistent red banner "Email not sent"
- [ ] Entering correct code advances to phone step
- [ ] "Skip for now" on phone step routes to the role's home
- [ ] "Resend code" button re-triggers the email

### 1.8 Forgot password (/forgot-password)
- [ ] Email field present
- [ ] Submit with real email → 6-digit code arrives
- [ ] Submit with fake email → silent success (no account enumeration)
- [ ] Code + new password form shows after submit
- [ ] Correct code + password → routes to /login with success toast

---

## 2. Customer portal (signed in as gz-test-customer)

### 2.1 Account dashboard (/account)
- [ ] Sidebar: Dashboard, Discover, Wishlist, My Collection, COA & NFC, Orders, Resell, Profile all visible
- [ ] Dashboard tiles show real data (or honest empty states)
- [ ] Switch theme + Sign out both work from avatar menu

### 2.2 Cart (/cart)
- [ ] Shows items added (if any) + prices
- [ ] Remove button removes item + updates header badge
- [ ] "Checkout" routes to /checkout
- [ ] Empty cart shows CTA "Browse the marketplace"

### 2.3 Wishlist (/wishlist)
- [ ] Shows wishlisted pieces
- [ ] Heart toggle removes item
- [ ] Empty state present

### 2.4 Checkout (/checkout?artworkId=...)
- [ ] Step 1 — artwork preview + price breakdown
- [ ] Step 2 — address picker: existing addresses + "Add new address" dialog
- [ ] Add address: all fields validate (name, pincode, phone)
- [ ] Step 3 — "Ready to place your order" summary + "Pay ₹X" button
- [ ] Clicking Pay opens Razorpay modal

### 2.5 Payment happy path (CRITICAL)
- [ ] Use test card `4111 1111 1111 1111` + any OTP
- [ ] Payment succeeds → success screen "Order placed" renders
- [ ] Order appears in /account/orders as "Paid"
- [ ] Artwork **disappears from /marketplace** (not still listed)

### 2.6 Payment dismiss (CRITICAL — was broken)
- [ ] Open Razorpay → close the modal without paying
- [ ] UI stays on checkout page, shows "Payment cancelled — nothing was charged" toast
- [ ] Order appears in /account/orders as **Pending** (NOT "Bought"/"Paid")
- [ ] Opening the pending order shows **new "Finish paying for this order"** box
- [ ] Clicking "Complete payment · ₹X" re-opens Razorpay on the SAME order
- [ ] Paying it this time flips order to Paid
- [ ] Price breakdown label says "Order total" on pending, "Total paid" once paid

### 2.7 Orders (/account/orders)
- [ ] All past orders listed newest-first
- [ ] Status badges: Pending / Paid / Unlocked (if NFC unlinked)
- [ ] Clicking a row opens detail
- [ ] "Download Excel" button exports a spreadsheet

### 2.8 Order detail (/account/orders/<id>)
- [ ] Shows artwork thumbnail, title, artist
- [ ] Delivery address visible
- [ ] Price breakdown correct
- [ ] Status timeline (Placed / Paid / Packed / Transit / Delivered) renders
- [ ] For PAID orders: "Download invoice" button works → downloads a real PDF
- [ ] For PENDING orders: "Finish paying" box + "Complete payment" button (see §2.6)
- [ ] "Request a refund" button on paid orders → opens dialog

### 2.9 Addresses (/account/addresses)
- [ ] Add, Edit, Delete all work
- [ ] "Set as default" toggle
- [ ] Deleting the default address asks for confirmation

### 2.10 My Collection (/account/collection)
- [ ] Shows pieces you own
- [ ] Each card has: image, title, artist, "Transfer rights" button
- [ ] "Transfer rights" opens dialog (new flow — see §2.11)
- [ ] COA + Passport links work

### 2.11 Transfer rights (resale — NEW)
- [ ] From collection → click "Transfer rights"
- [ ] Dialog opens with: toggle Ownership/Display, recipient email, giving price
- [ ] Entering a price shows the 5% fee split live (2% artist + 3% platform + 18% GST)
- [ ] Submit with non-registered email → clear error
- [ ] Submit with registered email → "Transfer created" with copy-link
- [ ] Recipient signs in and opens the link → sees price + "Confirm" button
- [ ] After recipient confirms: sender receives email + sees "Pay transfer fee" in /account
- [ ] Paying the fee moves ownership + writes artist royalty settlement

### 2.12 COA & NFC (/account/coa-nfc)
- [ ] Shows your pieces with NFC state
- [ ] Preview certificate button → opens dialog with certificate
- [ ] Display card → opens printable card with QR

### 2.13 Resell (/account/resale)
- [ ] Shows pieces you can resell
- [ ] List price flow works (similar to transfer rights)
- [ ] Withdraw listing flow works

### 2.14 Profile (/account/settings)
- [ ] Name, phone, avatar editable
- [ ] Notification preferences save (abandoned cart, marketing, weekly, push)
- [ ] "Delete my account" — dialog appears, requires confirmation

### 2.15 Support
- [ ] "Open help assistant" bubble (bottom right) opens FAQ assistant
- [ ] Contact form submission works

---

## 3. Artist portal (signed in as gz-test-oauth)

### 3.1 Dashboard (/dashboard)
- [ ] Revenue chart renders (may be empty)
- [ ] Verification tier panel shows current state
- [ ] Recent activity lists events
- [ ] Sidebar: 15 items, all click through

### 3.2 My Profile (/dashboard/profile) — KYC
- [ ] Bio, photo, social links editable
- [ ] Bank details, PAN, Aadhaar form fields present
- [ ] "Submit for review" → KYC moves to "Submitted"
- [ ] Artist agreement MOU section signable

### 3.3 Add Artwork (/dashboard/artworks/upload)
- [ ] Image upload works (drag + drop or click)
- [ ] **Category dropdown shows ONLY "Painting"** (no sculpture/digital)
- [ ] **Medium dropdown shows ONLY painting mediums** (no bronze/ceramic)
- [ ] Price/dimension/description all save
- [ ] "Save as draft" works
- [ ] "Submit for review" works (requires KYC)
- [ ] If KYC missing, bottom bar says "Finish KYC before submitting for review" — but doesn't block Save Draft

### 3.4 My Artworks (/dashboard/artworks)
- [ ] All submissions listed with status badges
- [ ] Filter tabs: All, Draft, Pending, Live, With aggregator, Sold, Sold elsewhere, Returned
- [ ] "Continue editing" opens draft
- [ ] "Send for review" moves to pending
- [ ] "Sold on other platform" → requires reason + fee notice
- [ ] Search by title works

### 3.5 Orders (/dashboard/orders)
- [ ] Shows orders where you are the artist
- [ ] Status badges correct
- [ ] Each row shows buyer city (NOT full address)

### 3.6 Earnings (/dashboard/earnings)
- [ ] Wallet balance visible
- [ ] Transaction list present
- [ ] "Request withdrawal" dialog opens (min ₹1,000)

### 3.7 Settlements (/dashboard/settlements)
- [ ] Each paid sale has a settlement row
- [ ] Status: Pending / Processed / Failed
- [ ] Download Excel button

### 3.8 Portfolio (/dashboard/portfolio)
- [ ] Public preview of your artist page
- [ ] "View public profile" opens /artists/<id>

### 3.9 COA & NFC (/dashboard/coa-nfc)
- [ ] Each piece shows: COA number, NFC state (Linked / Unlocked / Locked)
- [ ] Preview certificate works
- [ ] Display card print works
- [ ] "Link NFC" button → mobile-app prompt (web stub OK)

### 3.10 Analytics (/dashboard/analytics)
- [ ] Views, likes, inquiries per piece
- [ ] Time range picker works

### 3.11 Messages (/dashboard/messages)
- [ ] Inbox shows threads (if any)
- [ ] Reply + send works
- [ ] Mark read / archive

### 3.12 Blogs (/dashboard/blogs)
- [ ] Draft, Review, Published tabs
- [ ] "New post" opens editor
- [ ] Image upload in editor works
- [ ] "Submit for review" moves to review tab

### 3.13 Aggregator Display (/dashboard/aggregator)
- [ ] Which galleries have your pieces
- [ ] Links to the gallery profile

### 3.14 Support (/dashboard/support)
- [ ] Ticket form submits
- [ ] FAQ accordion works

### 3.15 Artist settings (/dashboard/settings)
- [ ] Account settings
- [ ] Notification toggles
- [ ] Delete account flow

---

## 4. Aggregator portal (signed in as gz-test-aggregator)

### 4.1 Dashboard (/aggregator/dashboard)
- [ ] Active reservations, Commission earned, Pending settlements tiles
- [ ] Recent activity
- [ ] "You earn 20% of 30% markup" slab explanation panel
- [ ] Sales conversion chart

### 4.2 My Profile (/aggregator/profile)
- [ ] Company details, address, GSTIN editable
- [ ] "Verify GSTIN" button works (Cashfree API)
- [ ] MOU signing works
- [ ] Bank details save

### 4.3 Browse GalleryZone (/aggregator/browse)
- [ ] Reservable artworks grid
- [ ] Filters (All / Painting only)
- [ ] Search by artwork, artist, style
- [ ] Clicking a piece opens reserve detail

### 4.4 Reserve an artwork (CRITICAL — was broken)
- [ ] From Browse → click a piece → "Reserve this piece" panel opens
- [ ] "Your selling price" field validates (can't be below GalleryZone price)
- [ ] "Where this price goes" breakdown correct
- [ ] "Advance 5%" + "Delivery" + "Pay now through Razorpay" rows render
- [ ] Clicking "Pay now" opens Razorpay
- [ ] Pay with test card → piece appears in "My Inventory" + holding created
- [ ] **Dismiss Razorpay → NEW: human message, NOT "razorpayOrderId: Required…"**

### 4.5 My Inventory (/aggregator/inventory)
- [ ] All reserved pieces shown with countdown to expiry
- [ ] "Request extension" dialog on near-expiry pieces
- [ ] "Return holding" dialog
- [ ] "Record a sale" dialog on each piece

### 4.6 Record a sale (CRITICAL)
- [ ] Dialog opens from a held piece
- [ ] Buyer details form: name, email, phone, address, payment route
- [ ] Payment route options: Cash, Bank transfer, GalleryZone pay-in
- [ ] "GalleryZone pay-in" opens Razorpay
- [ ] Submit creates a sale record + holding goes to "sold pending settlement"

### 4.7 Orders & Sales (/aggregator/orders-sales)
- [ ] Both lists present (marketplace orders + aggregator sales)
- [ ] Filter by status
- [ ] Clicking opens detail

### 4.8 Customers (/aggregator/customers)
- [ ] CRM-style list of buyers
- [ ] Each shows total spent, last purchase, items bought
- [ ] Search by email/name

### 4.9 Display Spaces (/aggregator/display-spaces)
- [ ] Add, Edit, Delete gallery spaces
- [ ] Photos upload

### 4.10 Shipping & Logistics (/aggregator/shipping)
- [ ] Inbound: artworks GalleryZone is sending your way — tracker visible
- [ ] Outbound: sold pieces — "Mark dispatched" / "Mark delivered" buttons work
- [ ] Shiprocket AWB visible per shipment

### 4.11 Earnings (/aggregator/earnings)
- [ ] Wallet balance
- [ ] Transaction list
- [ ] Add funds button opens Razorpay top-up

### 4.12 Settlements (/aggregator/settlements)
- [ ] Each sold piece has a settlement row
- [ ] Cash sales owed table (remittance due)
- [ ] "Remit cash" button opens Razorpay
- [ ] "Mark remitted" (legacy — one tap writes it)

### 4.13 Analytics (/aggregator/analytics)
- [ ] Reservation conversion rate
- [ ] Sales per month
- [ ] Top customers

### 4.14 Messages (/aggregator/messages)
- [ ] Thread list
- [ ] Reply works

### 4.15 Settings (/aggregator/settings)
- [ ] Notification toggles (NEW: warning note says "browser-local, email still sends")
- [ ] Delete account

### 4.16 Support (/aggregator/support)
- [ ] Ticket form
- [ ] FAQ

---

## 5. Admin portal (signed in as gz-test-admin)

### 5.1 Overview (/admin)
- [ ] 15 KPI tiles populate (may be empty on fresh prod)
- [ ] Revenue chart renders
- [ ] Recent activity list

### 5.2 Moderation / Artwork Queue (/admin/moderation/artworks)
- [ ] Submissions awaiting approval listed
- [ ] Clicking a row opens detail
- [ ] "Set rank" (R/U/O/S) + "Approve" → piece goes to marketplace
- [ ] "Reject" → requires reason

### 5.3 Moderation / KYC (/admin/moderation/kyc)
- [ ] Each entry shows artist + submitted documents
- [ ] View Aadhaar / PAN / bank
- [ ] Approve / Reject with reason

### 5.4 Moderation / GST (/admin/moderation/gst)
- [ ] Aggregator GSTIN submissions
- [ ] Verify via Cashfree
- [ ] Approve / Reject

### 5.5 Moderation / Payouts (/admin/moderation/withdrawals)
- [ ] Pending withdrawal requests from artists + customers
- [ ] Each row shows amount + bank details
- [ ] "Approve" (triggers manual bank transfer workflow)
- [ ] "Reject" with reason

### 5.6 Moderation / Blog Review (/admin/moderation/blogs)
- [ ] Pending blog posts
- [ ] Approve / Reject with reason

### 5.7 Moderation / Holding Reports (/admin/moderation/holding-reports)
- [ ] Aggregator-reported holding issues
- [ ] Resolve with note

### 5.8 Moderation / Off-platform Fees (/admin/moderation/external-fees)
- [ ] Artist-reported "sold elsewhere" with penalty
- [ ] Apply or waive fee

### 5.9 Moderation / Deactivations (/admin/moderation/deactivations)
- [ ] Artist deactivation requests
- [ ] Approve / Reject with reason

### 5.10 Catalog / Artworks (/admin/artworks)
- [ ] Every artwork on the platform
- [ ] Admin can set rank, delist, restore

### 5.11 Catalog / NFC Tags (/admin/nfc)
- [ ] Reset defective tag link
- [ ] Override ship gate

### 5.12 Catalog / Categories (/admin/categories)
- [ ] Add, Rename, Delete categories (keep painting-only)
- [ ] Delete rejects if category is in use

### 5.13 Catalog / Art Supplies (/admin/art-supplies)
- [ ] Add Amazon affiliate products
- [ ] URL field validates Amazon domain

### 5.14 People / Artists (/admin/artists)
- [ ] List of all artists
- [ ] Filter by KYC status
- [ ] Click → detail with suspend, mark TR, set GZ rating

### 5.15 People / Aggregators (/admin/aggregators)
- [ ] Same structure as artists

### 5.16 People / Customers (/admin/customers)
- [ ] Customer list
- [ ] Click → portfolio: user + orders + addresses

### 5.17 Commerce / Orders (/admin/orders)
- [ ] Every order on the platform
- [ ] Status + buyer + artist visible
- [ ] Clicking opens admin order view with full address

### 5.18 Commerce / Settlements (/admin/settlements) — CRITICAL
- [ ] Each settlement row shows: artwork, artist, amounts, status
- [ ] **NEW** "Mark paid" button on pending rows (artist royalty + ops cleanup)
- [ ] Retry button on failed rows
- [ ] Download Excel

### 5.19 System / Audit Logs (/admin/audit-logs)
- [ ] Every admin action logged
- [ ] Filter by admin, by action, by date

### 5.20 System / Reports (/admin/reports)
- [ ] Generate report for date range: sales, settlements, artist payouts, aggregator commission, GST summary
- [ ] Download CSV

### 5.21 System / Pricing Rules (/admin/pricing)
- [ ] Propose rate config change (markup, GST rate, min withdrawal, aggregator commission)
- [ ] Approve pending proposal → effective version increments

---

## 6. Diagnostics

### 6.1 Live backend config
```bash
curl https://gz-web-production.up.railway.app/v1/health/config
```
- [ ] `emailDeliveryReady: true` — set EMAIL_FROM on Railway if false
- [ ] `paymentsMode: "razorpay"` — real money will move if true
- [ ] `paymentsConfigured: true`
- [ ] `smsConfigured: false` — MSG91 awaiting DLT approval (expected)
- [ ] `adminSeedConfigured: true` — admin auto-seeds on boot
- [ ] `otpSecretConfigured: true`
- [ ] `publicSiteUrl` matches your prod domain

### 6.2 Known gaps
- [ ] Phone SMS OTP returns 503 (MSG91 DLT pending — expected)
- [ ] Artist-to-artist connect button hidden (backend endpoint "coming soon")
- [ ] Aggregator notification toggles are browser-local (see new note on screen)

### 6.3 Mobile app
- [ ] Install `~/Desktop/galleryzone-staging-v4.apk` on an Android phone
- [ ] Sign in works
- [ ] Marketplace browse works
- [ ] Add to cart works (once mobile auth session is set)
- [ ] NFC scan on an artwork you own works
- [ ] Floating glass bottom nav looks clean

---

## 7. If something breaks

For each broken item, note:

1. **URL** you were on
2. **What you clicked / typed**
3. **What you expected**
4. **What happened** (screenshot the toast / console error if possible)
5. **Browser** (Chrome / Safari / Firefox + version)
6. **Role** (customer / artist / aggregator / admin)

Send me the list — I'll triage, fix, and push the same day.

---

## 8. What I've already verified in a real browser

| Portal | Pages loaded | Mutations clicked |
|---|---|---|
| Public | 8/8 | Search ✅, Register ✅ |
| Customer | 5/15 | Invoice download ✅ |
| Artist | 2/15 | Upload form dropdowns ✅ |
| Aggregator | 2/16 | None (all read-only tested) |
| Admin | 20/21 | None (would mutate prod state) |

**~60% of pages probed. <10% of mutations tested live.** The checklist above fills in what I haven't done.
