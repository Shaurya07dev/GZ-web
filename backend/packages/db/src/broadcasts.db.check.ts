// Run (needs Java for the emulator):  npm run check:broadcasts-db
//
// Real-Firestore-emulator check of broadcasts.ts: who a broadcast reaches, what each recipient is given, what is
// refused, and a big audience crossing the 200-per-batch line. Not part of `npm run check` because that suite has
// no emulator (broadcasts.check.ts covers the pure part).

import assert from "node:assert/strict";
import { BroadcastError, Collections, broadcastReach, createDb, listBroadcasts, listMessages, listNotifications, sendBroadcast } from "./index.ts";

const { db, close } = createDb("demo-gz");

async function user(id: string, role: string, status = "active", name = id) {
  await db.collection(Collections.users).doc(id).set({ role, status, name, email: `${id}@example.in` });
}

// ---- who exists
await user("admin1", "admin", "active", "Priya Sharma");
for (const n of [1, 2, 3]) await user(`artist${n}`, "artist");
await user("artist-pending", "artist", "pending");
await user("artist-suspended", "artist", "suspended");
await user("artist-blocked", "artist", "blocked");
for (const n of [1, 2]) await user(`agg${n}`, "aggregator");
await user("agg-suspended", "aggregator", "suspended");
await user("customer1", "customer");

assert.deepEqual(await broadcastReach(db), { artist: 4, aggregator: 2 }, "suspended and blocked accounts are not counted");

const inboxOf = async (uid: string) => ({ messages: await listMessages(db, uid), bell: await listNotifications(db, uid) });
const ARTISTS = ["artist1", "artist2", "artist3", "artist-pending"];
const NOT_ARTISTS = ["artist-suspended", "artist-blocked", "agg1", "agg2", "agg-suspended", "customer1", "admin1"];

// ---- to artists only
const first = await sendBroadcast(db, { adminId: "admin1", audiences: ["artist"], title: "Hello artists", body: "Line one\nline two", url: null });
assert.equal(first.recipientCount, 4);
for (const uid of ARTISTS) {
  const { messages, bell } = await inboxOf(uid);
  assert.equal(messages.length, 1, `${uid} has one message`);
  const m = messages[0]!;
  assert.equal(m.fromLabel, "GalleryZone");
  assert.equal(m.subject, "Hello artists");
  assert.equal(m.body, "Line one\nline two", "the message keeps its line breaks");
  assert.equal(m.preview, "Line one line two", "the preview is one line");
  assert.equal(m.unread, true);
  assert.equal(m.id, `bc_${first.id}_${uid}`, "the id is fixed, so a retry cannot deliver twice");
  assert.equal(typeof JSON.parse(JSON.stringify(m)).receivedAt._seconds, "number", "the time reaches the browser in the shape the Messages page reads");
  assert.equal(bell.items.length, 1);
  assert.equal(bell.unreadCount, 1);
  assert.equal(bell.items[0]!.url, "/dashboard/messages", "an artist's bell opens their Messages");
}
for (const uid of NOT_ARTISTS) {
  const { messages, bell } = await inboxOf(uid);
  assert.equal(messages.length, 0, `${uid} gets nothing`);
  assert.equal(bell.items.length, 0);
}

// ---- to aggregators only, with a page to open
const second = await sendBroadcast(db, { adminId: "admin1", audiences: ["aggregator"], title: "Hello galleries", body: "Reservations are open.", url: "/aggregator/inventory" });
assert.equal(second.recipientCount, 2);
for (const uid of ["agg1", "agg2"]) {
  const { messages, bell } = await inboxOf(uid);
  assert.equal(messages.length, 1);
  assert.equal(bell.items[0]!.url, "/aggregator/inventory", "a chosen page wins over the default");
}
assert.equal((await inboxOf("agg-suspended")).messages.length, 0);
assert.equal((await inboxOf("artist1")).messages.length, 1, "artists did not get the aggregator message");

// ---- to both
const third = await sendBroadcast(db, { adminId: "admin1", audiences: ["artist", "aggregator"], title: "Everyone", body: "Maintenance on Sunday.", url: null });
assert.equal(third.recipientCount, 6);
assert.equal((await inboxOf("artist1")).messages.length, 2);
assert.equal((await inboxOf("agg1")).messages.length, 2);
assert.equal((await inboxOf("agg1")).bell.items.find((n) => n.title === "Everyone")!.url, "/aggregator/messages", "an aggregator's default bell opens their Messages");

// ---- what the admin sees
const sent = await listBroadcasts(db);
assert.deepEqual(sent.map((b) => b.title), ["Everyone", "Hello galleries", "Hello artists"], "newest first");
assert.equal(sent[0]!.sentByName, "Priya Sharma");
assert.equal(sent[0]!.recipientCount, 6);

// ---- refusals write nothing
const before = (await db.collection(Collections.broadcasts).get()).size;
for (const bad of [
  { audiences: [], title: "x", body: "x" },
  { audiences: ["artist"], title: "   ", body: "x" },
  { audiences: ["artist"], title: "x", body: "   " },
  { audiences: ["artist"], title: "x".repeat(81), body: "x" },
] as const) {
  await assert.rejects(() => sendBroadcast(db, { adminId: "admin1", audiences: [...bad.audiences], title: bad.title, body: bad.body, url: null }), BroadcastError);
}
assert.equal((await db.collection(Collections.broadcasts).get()).size, before, "a refused broadcast leaves no record");

// ---- a big audience crosses the 200-per-batch line (200 recipients = 400 writes in one batch)
const batch = db.batch();
for (let i = 0; i < 450; i++) batch.set(db.collection(Collections.users).doc(`bulk${i}`), { role: "aggregator", status: "active", name: `bulk${i}`, email: `bulk${i}@example.in` });
await batch.commit();
const big = await sendBroadcast(db, { adminId: "admin1", audiences: ["aggregator"], title: "Big one", body: "To many.", url: null });
assert.equal(big.recipientCount, 452, "450 new plus the 2 active aggregators");
const delivered = await db.collection(Collections.messageThreads).where("subject", "==", "Big one").count().get();
assert.equal(delivered.data().count, 452, "every one of them was written");
assert.equal((await inboxOf("bulk449")).messages.length, 1, "the last one in the last batch got it");

await close();
console.log("broadcasts.db.check.ts: ok");
