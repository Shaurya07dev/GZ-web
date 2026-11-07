// Run: node --experimental-strip-types apps/api/src/mail/emails.check.ts
//      node --experimental-strip-types apps/api/src/mail/emails.check.ts --out ../email-previews
//
// Renders every email in the catalogue with sample data and checks what a
// reader would notice: names and titles escaped once and only once, a plain-text
// part with no markup or entities in it, every link absolute, readable colours,
// a subject that fits an inbox. With --out it also writes each email as HTML
// and text, plus an index page, to look at in a browser.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COLOR, renderEmail } from "./layout.ts";
import { catalogue, inr, orderStatusBuyer, orderStatusArtist, artworkApproved, type Content } from "./templates.ts";
import { esc, rich, strong } from "./rich.ts";

const SITE = "https://www.galleryzone.in";
const ctx = { site: SITE };

// ── Colour contrast (WCAG 2.x) ──────────────────────────────────────────
function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const pairs: Array<[string, string, string]> = [
  ["body text on the card", COLOR.ink, COLOR.card],
  ["muted text on the card", COLOR.muted, COLOR.card],
  ["muted text on the page", COLOR.muted, COLOR.page],
  ["muted text on the receipt", COLOR.muted, COLOR.well],
  ["links on the card", COLOR.link, COLOR.card],
  ["links on the page", COLOR.link, COLOR.page],
  ["button label on the button", COLOR.buttonInk, COLOR.button],
  ["logo fallback text on the header band", COLOR.bandInk, COLOR.band],
  ["dark mode: body text on the card", COLOR.dark.ink, COLOR.dark.card],
  ["dark mode: muted text on the card", COLOR.dark.muted, COLOR.dark.card],
  ["dark mode: muted text on the page", COLOR.dark.muted, COLOR.dark.page],
  ["dark mode: muted text on the receipt", COLOR.dark.muted, COLOR.dark.well],
  ["dark mode: links on the card", COLOR.dark.link, COLOR.dark.card],
  ["dark mode: links on the page", COLOR.dark.link, COLOR.dark.page],
];
for (const [what, fg, bg] of pairs) {
  assert.ok(contrast(fg, bg) >= 4.5, `${what} is ${contrast(fg, bg).toFixed(2)}:1, under the 4.5:1 that small text needs`);
}

// ── Escaping: once, and only once ───────────────────────────────────────
{
  const title = `Dusk & Dawn: Krishna's "Flute" <b>`;
  const c = artworkApproved({ title, artworkId: "a1", certificateNumber: "GZ-1&2" }, ctx);
  const { html, text } = renderEmail(ctx, c.layout);
  assert.ok(html.includes("Dusk &amp; Dawn: Krishna&#39;s &quot;Flute&quot; &lt;b&gt;"), "the title is escaped once in the HTML");
  assert.ok(!html.includes("&amp;amp;") && !html.includes("&amp;#39;") && !html.includes("&amp;quot;"), "nothing is escaped twice");
  assert.ok(!html.includes("<b>"), "markup in a title cannot get into the page");
  assert.ok(text.includes(`Dusk & Dawn: Krishna's "Flute" <b>`), "the plain-text part carries the title as written, with no entities");
  assert.ok(text.includes("GZ-1&2"), "details are plain text too");

  const heading = renderEmail(ctx, { heading: "Welcome, Priya & Co", paragraphs: [rich`${strong("Priya & Co")} asked.`] });
  assert.ok(heading.html.includes("<h1") && heading.html.includes("Welcome, Priya &amp; Co</h1>"), "a heading is escaped once");
  assert.ok(heading.html.includes("<strong>Priya &amp; Co</strong>"), "emphasis escapes what is inside it");
  assert.ok(heading.text.startsWith("Welcome, Priya & Co\n"), "and the text heading is plain");
  assert.equal(esc("<&>"), "&lt;&amp;&gt;");
}

// ── Money and dates ─────────────────────────────────────────────────────
assert.equal(inr(1_850_000), "₹18,500");
assert.equal(inr(1_850_050), "₹18,500.50");
assert.equal(inr(5), "₹0.05");
assert.equal(inr(1_000_000_000), "₹1,00,00,000", "Indian digit grouping: lakhs and crores");

// ── Order status: only real statuses, only the right people ─────────────
for (const status of ["pending", "paid"] as const) {
  assert.equal(orderStatusBuyer({ orderId: "o", title: "t", status }, ctx), null, `${status} is covered by the payment emails`);
  assert.equal(orderStatusArtist({ orderId: "o", title: "t", status }, ctx), null);
}
assert.equal(orderStatusArtist({ orderId: "o", title: "t", status: "packed" }, ctx), null, "the artist packed it themselves; no email for that");
assert.ok(orderStatusBuyer({ orderId: "o", title: "t", status: "transit", carrier: "Delhivery", estimatedDays: 1 }, ctx)?.layout.details?.some(([k, v]) => k === "Courier's estimate" && v === "about 1 day"));

// ── Subject lines stay short even for long titles ───────────────────────
{
  const long = "A".repeat(200);
  const c = artworkApproved({ title: long, artworkId: "a1", certificateNumber: null }, ctx);
  assert.ok(c.subject.length <= 80, `subject is ${c.subject.length} characters`);
}

// ── Every email in the catalogue ────────────────────────────────────────
const ids = new Set<string>();
const rendered: Array<{ id: string; who: string; when: string; content: Content; html: string; text: string }> = [];
for (const entry of catalogue) {
  assert.ok(!ids.has(entry.id), `duplicate catalogue id ${entry.id}`);
  ids.add(entry.id);
  const content = entry.make(ctx);
  assert.ok(content, `${entry.id} did not render`);
  const { html, text } = renderEmail(ctx, content.layout);
  rendered.push({ id: entry.id, who: entry.who, when: entry.when, content, html, text });

  const here = `[${entry.id}]`;
  assert.ok(content.subject.trim().length >= 8 && content.subject.length <= 110, `${here} subject "${content.subject}" is ${content.subject.length} characters`);
  assert.ok(!/undefined|NaN|\[object|null\b/.test(content.subject + html + text.replace(/\bnull\b/g, "")), `${here} has an unfilled value in it`);
  assert.equal(html.split("<h1").length - 1, 1, `${here} should have exactly one heading`);
  assert.ok(html.includes("<title>") && html.includes('lang="en"'), `${here} needs a title and a language`);
  assert.ok(Buffer.byteLength(html) < 60_000, `${here} is ${Buffer.byteLength(html)} bytes; Gmail clips at 102 KB`);

  // Markup is balanced.
  for (const tag of ["table", "tr", "td", "p"]) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, "g")) ?? []).length;
    const close = (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    assert.equal(open, close, `${here} has ${open} <${tag}> and ${close} </${tag}>`);
  }

  // The plain-text part is plain.
  assert.ok(!/<\/?[a-z][^>]*>/i.test(text), `${here} text part has markup in it`);
  assert.ok(!/&(amp|lt|gt|quot|#39|nbsp|zwnj);/.test(text), `${here} text part has HTML entities in it`);
  assert.ok(text.length > 60, `${here} text part is empty`);

  // Every link is an absolute https link on the site.
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]!);
  assert.ok(hrefs.length >= 3, `${here} has no links`);
  for (const href of hrefs) assert.ok(href.startsWith(`${SITE}`), `${here} links to ${href}`);
  if (content.layout.cta) {
    assert.ok(content.layout.cta.url.startsWith(`${SITE}/`) && !content.layout.cta.url.includes("//", 9), `${here} button link ${content.layout.cta.url}`);
    assert.ok(content.layout.cta.label.length <= 28, `${here} button label "${content.layout.cta.label}" is too long to fit one line on a phone`);
  }
  assert.ok(content.layout.heading.length <= 64, `${here} heading is ${content.layout.heading.length} characters`);
  assert.ok(content.layout.paragraphs.length >= 1, `${here} has no body`);
}

// Money emails carry a receipt.
for (const id of ["order-paid-buyer", "order-paid-artist", "wallet-topup", "remittance-received", "withdrawal-paid", "holding-returned-aggregator"]) {
  const r = rendered.find((x) => x.id === id);
  assert.ok(r?.content.layout.details?.length, `${id} should carry a receipt`);
}

// Who gets what: no collector email links into a dashboard they don't have, and vice versa.
const prefixes: Record<string, string[]> = { Collector: ["/account", "/marketplace", "/cart", "/transfer", "/verify"], Artist: ["/dashboard", "/marketplace", "/blogs", "/verify"], Aggregator: ["/aggregator"], Admin: ["/admin"] };
for (const r of rendered) {
  const allowed = prefixes[r.who];
  const url = r.content.layout.cta?.url;
  if (!allowed || !url) continue;
  const path = url.slice(SITE.length);
  assert.ok(allowed.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`)), `[${r.id}] is for a ${r.who} but its button goes to ${path}`);
}

// The readable list of emails must name every email in the catalogue, so it cannot go stale.
{
  const docUrl = new URL("../../../../../docs/EMAIL_EVENTS.md", import.meta.url);
  if (existsSync(docUrl)) {
    const doc = readFileSync(docUrl, "utf8");
    const missing = rendered.filter((r) => !doc.includes("`" + r.id + "`")).map((r) => r.id);
    assert.deepEqual(missing, [], "docs/EMAIL_EVENTS.md does not list: " + missing.join(", "));
  }
}

console.log(`emails.check: ${rendered.length} emails render cleanly (${pairs.length} colour pairs, escaping, links, text part)`);

// ── Previews ────────────────────────────────────────────────────────────
const outAt = process.argv.indexOf("--out");
if (outAt > 0 && process.argv[outAt + 1]) {
  const dir = process.argv[outAt + 1]!;
  mkdirSync(dir, { recursive: true });
  for (const r of rendered) {
    writeFileSync(join(dir, `${r.id}.html`), r.html);
    writeFileSync(join(dir, `${r.id}.txt`), r.text);
  }
  const groups = ["Everyone", "Collector", "Artist", "Aggregator", "Admin"];
  const rows = groups
    .map((g) => {
      const list = rendered.filter((r) => r.who === g);
      return `<h2>${g} <small>(${list.length})</small></h2><table>${list.map((r) => `<tr><td><a href="${r.id}.html">${esc(r.content.subject)}</a></td><td>${esc(r.when)}</td><td><a href="${r.id}.txt">text</a></td></tr>`).join("")}</table>`;
    })
    .join("");
  writeFileSync(join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><title>GalleryZone emails</title><style>body{font:15px/1.5 system-ui;margin:32px auto;max-width:960px;padding:0 16px}td{padding:6px 14px 6px 0;border-bottom:1px solid #ddd;vertical-align:top}table{border-collapse:collapse;width:100%}small{color:#777}</style><h1>GalleryZone emails (${rendered.length})</h1>${rows}`);
  writeFileSync(join(dir, "catalogue.json"), JSON.stringify(rendered.map((r) => ({ id: r.id, who: r.who, when: r.when, subject: r.content.subject, category: r.content.category })), null, 2));
  console.log(`previews written to ${dir}`);
}
