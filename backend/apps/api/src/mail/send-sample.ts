// Sends sample emails, with made-up data, through Resend, so they can be read in
// real inboxes (Gmail, Outlook, iCloud, Yahoo; on a phone; in dark mode) before launch.
//
//   npm run email:send-sample -- you@example.com                      six representative emails
//   npm run email:send-sample -- you@example.com --all                every email in the catalogue
//   npm run email:send-sample -- you@example.com order-paid-buyer     only these (ids are in the catalogue)
//
// It uses the same settings as the API (RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO,
// PUBLIC_SITE_URL), so what arrives is what customers will get, from the same sender.
// Every subject starts with "[Sample]". Resend's own test addresses (delivered@resend.dev,
// bounced@resend.dev) work as the recipient to try the success and bounce paths.

import { Resend } from "resend";
import { renderEmail } from "./layout.ts";
import { catalogue } from "./templates.ts";

const [to, ...rest] = process.argv.slice(2);
// A function declaration, not an arrow: TypeScript only narrows after a call to a function it knows never returns.
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) fail("Usage: npm run email:send-sample -- you@example.com [--all | <email id> ...]");
const key = process.env.RESEND_API_KEY || fail("RESEND_API_KEY is not set.");
const from = process.env.EMAIL_FROM || fail("EMAIL_FROM is not set (for example: GalleryZone <hello@galleryzone.art>).");
if (/@resend\.dev>?$/i.test(from)) fail(`EMAIL_FROM is "${from}", Resend's test sender, which only delivers to the Resend account's own address. Use an address on the verified domain.`);

const site = (process.env.PUBLIC_SITE_URL || "https://www.galleryzone.art").replace(/\/$/, "");
const replyTo = process.env.EMAIL_REPLY_TO;
const wanted = rest.filter((a) => !a.startsWith("--"));
const unknown = wanted.filter((id) => !catalogue.some((e) => e.id === id));
if (unknown.length) fail(`Not in the catalogue: ${unknown.join(", ")}`);

const representative = ["welcome", "order-paid-buyer", "artwork-rejected", "sale-recorded-aggregator", "password-reset", "support-new-admin"];
const picks = rest.includes("--all") ? catalogue : catalogue.filter((e) => (wanted.length ? wanted : representative).includes(e.id));

const resend = new Resend(key);
let failed = 0;
for (const entry of picks) {
  const content = entry.make({ site });
  if (!content) continue;
  const { html, text } = renderEmail({ site }, content.layout);
  const { data, error } = await resend.emails.send(
    { from, to, subject: `[Sample] ${content.subject}`, html, text, ...(replyTo ? { replyTo } : {}), tags: [{ name: "email", value: "sample" }] },
    { idempotencyKey: `sample/${entry.id}/${Date.now()}` },
  );
  if (error) failed++;
  console.log(error ? `FAILED ${entry.id}: ${error.name}: ${error.message}` : `sent   ${entry.id} (${data?.id})`);
  await new Promise((resolve) => setTimeout(resolve, 300)); // well under Resend's 10 requests a second
}
console.log(`${picks.length - failed} of ${picks.length} sent to ${to}`);
process.exit(failed ? 1 : 0);
