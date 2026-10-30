// Run: node --experimental-strip-types packages/db/src/notifications.check.ts
// One notification per (account, event): a retried email never notifies twice
// and never un-reads what the user read; strangers' addresses notify nobody;
// one user can't read or mark another's.

import assert from "node:assert/strict";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationIdFor, plainText, recordNotifications } from "./notifications.ts";

type Data = Record<string, unknown>;
const docs = new Map<string, Data>();
let clock = 1_000;
// serverTimestamp() sentinels become a real, increasing Timestamp on write.
const resolve = (d: Data): Data =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v && typeof v === "object" && v.constructor?.name?.includes("Transform") ? Timestamp.fromMillis(clock++) : v]));

function query(col: string, filters: [string, string, unknown][] = [], order: string | null = null, max = Infinity) {
  const rows = () => {
    let r = [...docs].filter(([p]) => p.startsWith(`${col}/`) && !p.slice(col.length + 1).includes("/"));
    for (const [f, op, v] of filters) r = r.filter(([, d]) => (op === "in" ? (v as unknown[]).includes(d[f]) : d[f] === v));
    if (order) r.sort(([, a], [, b]) => (b[order] as Timestamp).toMillis() - (a[order] as Timestamp).toMillis());
    return r.slice(0, max).map(([p, d]) => ({ id: p.split("/").pop()!, ref: ref(p), data: () => d }));
  };
  return {
    where: (f: string, op: string, v: unknown) => query(col, [...filters, [f, op, v]], order, max),
    orderBy: (f: string) => query(col, filters, f, max),
    limit: (n: number) => query(col, filters, order, n),
    get: async () => {
      const d = rows();
      return { docs: d, empty: d.length === 0, size: d.length };
    },
    count: () => ({ get: async () => ({ data: () => ({ count: rows().length }) }) }),
  };
}
function ref(path: string) {
  return {
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    create: async (d: Data) => {
      if (docs.has(path)) throw Object.assign(new Error("ALREADY_EXISTS"), { code: 6 });
      docs.set(path, resolve(d));
    },
    update: async (d: Data) => void docs.set(path, { ...docs.get(path), ...resolve(d) }),
  };
}
const db = {
  collection: (col: string) => ({ ...query(col), doc: (id: string) => ref(`${col}/${id}`) }),
  batch: () => {
    const ops: (() => Promise<void>)[] = [];
    return { update: (r: ReturnType<typeof ref>, d: Data) => void ops.push(() => r.update(d)), commit: async () => void (await Promise.all(ops.map((o) => o()))) };
  },
} as unknown as Firestore;

docs.set("users/alice", { email: "alice@example.com" });
docs.set("users/bob", { email: "bob@example.com" });
docs.set("users/carol", { email: "Carol@Example.com" }); // stored as typed at registration

const event = { key: "order-paid-buyer/o1", title: "Order confirmed", body: "Your order is in.", url: "/account/orders/o1" };
assert.equal(await recordNotifications(db, { ...event, emails: ["Alice@Example.com ", "stranger@nowhere.test"] }), 1, "only real accounts are notified; email case is ignored");

let alice = await listNotifications(db, "alice");
assert.equal(alice.unreadCount, 1);
assert.deepEqual(alice.items.map((n) => [n.title, n.url, n.read]), [["Order confirmed", "/account/orders/o1", false]]);

assert.equal(await recordNotifications(db, { ...event, key: "k/carol", emails: ["Carol@Example.com"] }), 1, "a mixed-case stored address still matches");

// Read it, then the same email is retried: no duplicate, and it stays read.
await markNotificationRead(db, "alice", notificationIdFor(event.key));
assert.equal(await recordNotifications(db, { ...event, emails: ["alice@example.com"] }), 0);
alice = await listNotifications(db, "alice");
assert.equal(alice.items.length, 1);
assert.equal(alice.unreadCount, 0);
assert.equal(alice.items[0]!.read, true);

// Bob can't mark Alice's notification: his path has no such doc.
await assert.rejects(markNotificationRead(db, "bob", notificationIdFor(event.key)), /No notification/);
assert.equal((await listNotifications(db, "bob")).items.length, 0);

// Newest first, then read-all.
await recordNotifications(db, { key: "artwork-approved/a1", emails: ["alice@example.com"], title: "Live", body: "", url: null });
await recordNotifications(db, { key: "withdrawal-approved/w1", emails: ["alice@example.com"], title: "Payout sent", body: "", url: null });
alice = await listNotifications(db, "alice");
assert.deepEqual(alice.items.map((n) => n.title), ["Payout sent", "Live", "Order confirmed"]);
assert.equal(alice.unreadCount, 2);
assert.equal(await markAllNotificationsRead(db, "alice"), 2);
assert.equal((await listNotifications(db, "alice")).unreadCount, 0);

assert.equal(notificationIdFor("gst-rejected/u1/d9"), "gst-rejected__u1__d9");
assert.equal(plainText("<strong>Ravi</strong> bought &ldquo;x&rdquo; &amp; paid — it&#39;s &lt;done&gt;"), "Ravi bought &ldquo;x&rdquo; & paid — it's <done>");

console.log("packages/db/notifications.ts: one per account per event, retries keep read state, scoped per user, newest first");
