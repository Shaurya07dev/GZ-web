// Runs the real Emails service against the LOCAL demo emulator's seeded documents,
// with a fake mailer, to prove each lookup reads the right fields (the unit check
// renders templates; this one checks the reads that feed them).
//
//   1. npm run demo:emulators, then npm run demo:seed   (the demo stack, seeded)
//   2. npm run build --workspace=@galleryzone/api       (this imports the compiled service)
//   3. npm run check:email-demo
//
// SAFETY: emulator only; it refuses any project id that does not start with "demo-".
// It writes in-app notifications for the seeded users while it runs and deletes them
// again at the end.

import assert from "node:assert/strict";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8180";
const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-gz";
if (!projectId.startsWith("demo-")) {
  console.error("Refusing: emulator only");
  process.exit(1);
}

const base = new URL("../", import.meta.url).href;
const { createDb, Collections } = await import(base + "packages/db/src/index.ts");
const { Emails } = await import(base + "apps/api/dist/mail/emails.js");
const { db } = createDb(projectId);

const sent = [];
const mailer = { send: async (m) => (sent.push(m), "msg_test") };
const emails = new Emails(db, { corsOrigins: ["https://www.galleryzone.art"] }, mailer);

const before = new Set((await db.collectionGroup("notifications").get()).docs.map((d) => d.ref.path));

async function one(col, ...where) {
  let q = db.collection(col);
  for (const w of where) q = q.where(...w);
  const s = await q.limit(1).get();
  return s.docs[0] ? { id: s.docs[0].id, ...s.docs[0].data() } : null;
}
async function userBy(role) {
  return one(Collections.users, ["role", "==", role]);
}

const results = [];
async function run(label, fn, expectMails, expectSubject) {
  const n = sent.length;
  try {
    await fn();
  } catch (e) {
    results.push([label, "THREW", String(e)]);
    return;
  }
  const got = sent.slice(n);
  if (expectMails === 0) {
    results.push([label, got.length === 0 ? "ok (nothing sent)" : `UNEXPECTED ${got.length}`, ""]);
    return;
  }
  const subjects = got.map((m) => m.subject);
  const ok = got.length === expectMails && (!expectSubject || got.some((m) => expectSubject.test(m.subject)));
  for (const m of got) {
    assert.ok(m.to.length >= 1 && m.to.every((a) => /.+@.+\..+/.test(a)), `${label}: bad recipient ${m.to}`);
    assert.ok(m.html.includes("<h1") && m.text.length > 40 && m.idempotencyKey.length > 3 && m.tag, `${label}: incomplete mail`);
    assert.ok(!/&(amp|lt|gt|quot|#39);/.test(m.text), `${label}: entities in text part`);
    assert.ok(!/undefined|\[object|NaN/.test(m.subject + m.html + m.text), `${label}: unfilled value`);
  }
  results.push([label, ok ? "ok" : `WRONG: expected ${expectMails}`, subjects.join(" | ")]);
}

const artist = await userBy("artist");
const aggregator = await userBy("aggregator");
const customer = await userBy("customer");
const admin = await userBy("admin");
assert.ok(artist && aggregator && customer && admin, "demo users missing: run npm run demo:seed");

// ── Reads by id ──
const topup = await one(Collections.walletTopups, ["status", "==", "paid"]);
if (topup) await run("wallet top-up receipt", () => emails.walletTopupReceived(topup.id), 1, /Wallet top-up received/);
else results.push(["wallet top-up receipt", "SKIPPED (no paid top-up in the demo)", ""]);
const pendingTopup = await one(Collections.walletTopups, ["status", "==", "pending"]);
if (pendingTopup) await run("wallet top-up (still pending: no email)", () => emails.walletTopupReceived(pendingTopup.id), 0);

let remittance = await one(Collections.aggregatorRemittances, ["status", "==", "paid"]);
let tempRemittance = null;
if (!remittance) {
  // The demo has none: make one, and take it away again below.
  tempRemittance = db.collection(Collections.aggregatorRemittances).doc("emailtest-remittance");
  await tempRemittance.set({ aggregatorId: aggregator.id, saleIds: ["s1", "s2"], amountPaise: 210000, status: "paid", providerOrderId: null, providerPaymentId: null, method: "razorpay_upi", createdAt: new Date(), paidAt: new Date() });
  remittance = { id: tempRemittance.id };
}
await run("remittance receipt", () => emails.remittanceReceived(remittance.id), 1, /Remittance received: ₹2,100/);
assert.ok(sent.at(-1).html.includes("Sales covered") && sent.at(-1).html.includes(">2<") && sent.at(-1).html.includes("UPI"), "receipt shows the sale count and the payment method");
if (tempRemittance) await tempRemittance.delete();

const reserved = await one(Collections.aggregatorHoldings, ["status", "==", "reserved"]);
const anyHolding = reserved ?? (await one(Collections.aggregatorHoldings));
if (anyHolding) {
  await run("holding reserved (artist + aggregator)", () => emails.holdingReservedById(anyHolding.id), anyHolding.priceWarning ? 3 : 2, /Reserved:|reserved by a gallery/);
  const returned = await one(Collections.aggregatorHoldings, ["status", "==", "returned"]);
  if (returned) await run("holding returned (aggregator + artist)", () => emails.holdingReturned(returned.id), 2, /You returned|coming back/);
  else results.push(["holding returned", "SKIPPED (none returned in the demo)", ""]);
}

const sale = await one(Collections.aggregatorSales);
if (sale) await run("sale recorded (aggregator + artist)", () => emails.saleRecorded(sale.id), 2, /Sale recorded|Sold through/);
else results.push(["sale recorded", "SKIPPED (no sale in the demo)", ""]);

const accepted = await one(Collections.blogs, ["status", "==", "published"]);
const acceptedAny = accepted ?? (await one(Collections.blogs));
if (acceptedAny) {
  await run("blog published", () => emails.blogDecided({ blogId: acceptedAny.id, approved: true }), 1, /is published/);
  await run("blog returned", () => emails.blogDecided({ blogId: acceptedAny.id, approved: false, note: "Add a photo credit." }), 1, /needs changes/);
}

const reportDoc = await one(Collections.holdingReports);
if (reportDoc) {
  const row = { ...reportDoc, reportedAt: "", resolvedAt: null };
  await run("holding report filed (admin)", () => emails.holdingReportFiled(row), 1, /Holding report/);
  await run("holding report resolved (aggregator)", () => emails.holdingReportResolved({ ...row, resolutionNote: "Sorted." }), 1, /resolved/);
} else results.push(["holding report", "SKIPPED (none in the demo)", ""]);

const coa = await one(Collections.physicalCoaRequests);
if (coa) await run("certificate dispatched", () => emails.physicalCoaDispatched(coa.id), 1, /on its way/);
else results.push(["certificate dispatched", "SKIPPED (no request in the demo)", ""]);

const intent = await one(Collections.reservationIntents);
if (intent) {
  await run("reservation refunded", () => emails.reservationRefunded(intent.id), 1, /refunded/);
  await run("refund failed (admin)", () => emails.refundFailed(intent.id, "BAD_REQUEST_ERROR: test"), 1, /Refund failed/);
} else results.push(["reservation refund", "SKIPPED (no intent in the demo)", ""]);

const artwork = await one(Collections.artworks);
if (artwork) await run("artwork delisted", () => emails.artworkDelisted({ artworkId: artwork.id, reason: "Test." }), 1, /delisted/);

const order = await one(Collections.orders, ["status", "==", "transit"]);
const anyOrder = order ?? (await one(Collections.orders));
if (anyOrder) {
  await run("order in transit (buyer + artist)", () => emails.orderStatus({ orderId: anyOrder.id, customerId: anyOrder.customerId, artistId: anyOrder.artistId ?? null, title: "Test piece", status: "transit" }), anyOrder.artistId ? 2 : 1, /on its way/);
  await run("order packed (buyer only)", () => emails.orderStatus({ orderId: anyOrder.id, customerId: anyOrder.customerId, artistId: anyOrder.artistId ?? null, title: "Test piece", status: "packed" }), 1, /packed/);
  await run("order paid (buyer + artist)", () => emails.orderPaid({ orderId: anyOrder.id, customerId: anyOrder.customerId, artistId: anyOrder.artistId ?? artist.id, title: "Test piece", totalPaise: 1850000, artistNetPaise: 1480000 }), 2, /Order confirmed|Sold/);
}

// ── Direct inputs ──
await run("verification link again", () => emails.resendVerification(customer.id, "https://www.galleryzone.art/verify-email?token=x"), 1, /Confirm your email/);
const k1 = sent.at(-1).idempotencyKey;
await run("…and again: a different key each time", () => emails.resendVerification(customer.id, "https://www.galleryzone.art/verify-email?token=y"), 1);
assert.notEqual(k1, sent.at(-1).idempotencyKey, "resends must not share a key");
assert.ok(!sent.at(-1).idempotencyKey.startsWith("welcome/"), "and must not reuse the welcome's");
await run("mou signed", () => emails.mouSigned({ uid: artist.id, party: "artist", version: "2026-10-22", signatureName: "A. Artist", signedAt: new Date() }), 1, /signed the GalleryZone Artist MOU/);
await run("transfer accepted (to sender)", () => emails.transferAccepted({ transferId: "t1", artworkId: "a1", title: "Test piece", toName: "Priya", kind: "ownership", fromUserId: customer.id }), 1, /accepted/);
await run("transfer declined (to sender)", () => emails.transferDeclined({ transferId: "t1", artworkId: "a1", title: "Test piece", toName: "Priya", kind: "ownership", fromUserId: customer.id }), 1, /declined/);
await run("transfer cancelled (to invitee)", () => emails.transferCancelled({ transferId: "t1", toEmail: "invitee@example.in", fromName: "Arjun", title: "Test piece", kind: "display" }), 1, /cancelled/);
await run("transfer cancelled, no address: nothing", () => emails.transferCancelled({ transferId: "t1", toEmail: null, fromName: "Arjun", title: "Test piece", kind: "display" }), 0);
await run("support ticket (user + admins)", () => emails.supportTicketRaised({ ticketId: "tk1", userId: customer.id, subject: "Test", message: "Hello\nthere" }), 2, /We've got your message|Support:/);
assert.equal(sent.at(-1).replyTo, customer.email, "the admins' copy replies to the person who wrote");
await run("account suspended", () => emails.accountStatusChanged({ userId: artist.id, status: "suspended" }), 1, /suspended/);
await run("account status nobody knows: nothing", () => emails.accountStatusChanged({ userId: artist.id, status: "weird" }), 0);
await run("bank account changed", () => emails.bankAccountChanged({ userId: artist.id, maskedAccount: "•••• 4821" }), 1, /payout account/);
await run("withdrawal requested (user + admins)", () => emails.withdrawalRequested({ withdrawalId: "w1", userId: aggregator.id, amountPaise: 500000 }), 2, /Withdrawal/);
await run("insurance emails are gone", async () => assert.equal(typeof emails.insuranceDecided, "undefined"), 0);

// ── Report, then clean up ──
console.log("\n" + results.map(([a, b, c]) => `${b.startsWith("ok") ? "PASS" : b.startsWith("SKIP") ? "skip" : "FAIL"}  ${a}${c ? `\n        ${c}` : b.startsWith("ok") ? "" : `  -> ${b}`}`).join("\n"));
const failures = results.filter(([, b]) => !b.startsWith("ok") && !b.startsWith("SKIP"));

const after = (await db.collectionGroup("notifications").get()).docs;
const fresh = after.filter((d) => !before.has(d.ref.path));
for (const d of fresh) await d.ref.delete();
console.log(`\n${sent.length} emails captured; ${fresh.length} in-app notifications created and removed again; ${failures.length} problems`);
process.exit(failures.length ? 1 : 0);
