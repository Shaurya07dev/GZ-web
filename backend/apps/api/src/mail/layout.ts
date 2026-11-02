// The one layout every GalleryZone email is set in.
//
// Table layout with inline styles, because that is what Gmail, Outlook and
// Apple Mail all agree on; a small <style> block adds the phone layout and dark
// mode for the clients that read it (the inline colours are the fallback).
// Nothing here is built or fetched at send time except the logo, which is a
// 7 KB image on the site and falls back to the word GalleryZone if blocked.
//
// A layout is a description, not markup: heading, paragraphs, an optional
// receipt, an optional quoted note, an optional button. The plain-text part is
// written from the same description, so the two can never drift apart.

import { asHtml, asText, esc, type Rich } from "./rich.ts";

export type Audience = "collector" | "artist" | "aggregator" | "admin" | "anyone";
export type Text = string | Rich;

export interface Layout {
  /** What the inbox list shows beside the subject. Defaults to the start of the first paragraph. */
  preheader?: string;
  heading: string;
  paragraphs: Text[];
  /** A small receipt: label on the left, value on the right. */
  details?: Array<[label: string, value: Text]>;
  /** Someone else's words (a reviewer's reason, a message), set apart from ours. */
  note?: { label: string; text: string };
  cta?: { label: string; url: string };
  /** Small print under the button. */
  footnote?: Text;
  /** Who it is going to; picks the footer links. */
  audience?: Audience;
  /** Why they are getting it, when "you have a GalleryZone account" is not the whole story. */
  reason?: string;
}

export interface RenderContext {
  /** The public site, no trailing slash. */
  site: string;
}

/** Brand colours, from the website's tokens. The dark set is applied by the media query in the head. */
export const COLOR = {
  page: "#F3EFE9",
  card: "#FFFFFF",
  ink: "#211E18",
  muted: "#6B6358",
  line: "#E4DDD2",
  well: "#F8F5EF",
  link: "#8A6423",
  button: "#C89A4A",
  buttonInk: "#0B0A08",
  band: "#0B0A08",
  bandInk: "#E9C57A",
  dark: { page: "#0B0A08", card: "#16130F", ink: "#F1ECE0", muted: "#B5AB9C", line: "#2A241C", well: "#1E1A14", link: "#E9C57A" },
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const COMPANY = "GalleryZone Private Limited";

const DEFAULT_REASON: Record<Audience, string> = {
  collector: "You're getting this because you have a GalleryZone account.",
  artist: "You're getting this because you have a GalleryZone artist account.",
  aggregator: "You're getting this because you have a GalleryZone aggregator account.",
  admin: "You're getting this because you're a GalleryZone administrator.",
  anyone: "You're getting this because this address was used on GalleryZone.",
};

/** Only collectors have a notification-settings page today, so only they are offered it. */
function footerLinks(audience: Audience, site: string): Array<{ label: string; url: string }> {
  switch (audience) {
    case "collector":
      return [
        { label: "Help", url: `${site}/account/support` },
        { label: "Email preferences", url: `${site}/account/settings` },
      ];
    case "artist":
      return [{ label: "Help", url: `${site}/dashboard/support` }];
    case "aggregator":
      return [{ label: "Help", url: `${site}/aggregator/support` }];
    case "admin":
      return [];
    default:
      return [{ label: "Contact us", url: `${site}/contact` }];
  }
}

/** The start of a sentence, cut at a word, for the inbox preview. */
function snippet(text: string, max = 110): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

const style = (css: string): string => css.replace(/\s+/g, " ").trim();

const STYLE_BLOCK = style(`
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{border:0;display:block;}
  @media (max-width:620px){
    .wrap{width:100%!important;}
    .pad{padding-left:22px!important;padding-right:22px!important;}
    .h{font-size:24px!important;}
  }
  @media (prefers-color-scheme:dark){
    .page{background:${COLOR.dark.page}!important;}
    .card{background:${COLOR.dark.card}!important;border-color:${COLOR.dark.line}!important;}
    .well{background:${COLOR.dark.well}!important;}
    .bd{border-color:${COLOR.dark.line}!important;}
    .tx{color:${COLOR.dark.ink}!important;}
    .mu{color:${COLOR.dark.muted}!important;}
    .lk{color:${COLOR.dark.link}!important;}
  }
`);

function paragraph(p: Layout["paragraphs"][number]): string {
  return `<p class="tx" style="margin:0 0 16px;font:400 16px/1.6 ${SANS};color:${COLOR.ink};">${asHtml(p)}</p>`;
}

function details(rows: NonNullable<Layout["details"]>): string {
  const body = rows
    .map(([label, value], i) => {
      const border = i === rows.length - 1 ? "" : `border-bottom:1px solid ${COLOR.line};`;
      return `<tr><td class="mu bd" valign="top" style="padding:11px 0;${border}font:400 13px/1.5 ${SANS};color:${COLOR.muted};width:38%;">${esc(label)}</td><td class="tx bd" valign="top" align="right" style="padding:11px 0 11px 12px;${border}font:600 14px/1.5 ${SANS};color:${COLOR.ink};">${asHtml(value)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="well bd" bgcolor="${COLOR.well}" style="margin:4px 0 22px;background:${COLOR.well};border:1px solid ${COLOR.line};border-radius:10px;"><tr><td style="padding:2px 18px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${body}</table></td></tr></table>`;
}

function note(n: NonNullable<Layout["note"]>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 22px;"><tr><td class="well" bgcolor="${COLOR.well}" style="background:${COLOR.well};border-left:3px solid ${COLOR.button};border-radius:0 8px 8px 0;padding:14px 18px;"><p class="mu" style="margin:0 0 4px;font:600 12px/1.4 ${SANS};color:${COLOR.muted};">${esc(n.label)}</p><p class="tx" style="margin:0;font:400 15px/1.6 ${SANS};color:${COLOR.ink};white-space:pre-line;">${esc(n.text)}</p></td></tr></table>`;
}

function button(cta: NonNullable<Layout["cta"]>): string {
  const url = esc(cta.url);
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 6px;"><tr><td align="center" bgcolor="${COLOR.button}" style="background:${COLOR.button};border-radius:8px;"><a href="${url}" style="display:inline-block;padding:14px 28px;font:600 15px/1 ${SANS};color:${COLOR.buttonInk};text-decoration:none;border-radius:8px;">${esc(cta.label)}</a></td></tr></table><p class="mu" style="margin:14px 0 0;font:400 13px/1.5 ${SANS};color:${COLOR.muted};">If the button doesn't open, paste this link into your browser:<br><a class="lk" href="${url}" style="color:${COLOR.link};word-break:break-all;">${url}</a></p>`;
}

export function renderEmail(ctx: RenderContext, l: Layout): { html: string; text: string } {
  const { site } = ctx;
  const audience = l.audience ?? "anyone";
  const reason = l.reason ?? DEFAULT_REASON[audience];
  const links = footerLinks(audience, site);
  const preheader = l.preheader ?? snippet(asText(l.paragraphs[0] ?? ""));

  const footerLine = links.length
    ? `<p class="mu" style="margin:0 0 10px;font:400 12px/1.6 ${SANS};color:${COLOR.muted};">${links.map((x) => `<a class="lk" href="${esc(x.url)}" style="color:${COLOR.link};">${esc(x.label)}</a>`).join(" &nbsp;·&nbsp; ")}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(l.heading)}</title>
<style>${STYLE_BLOCK}</style>
</head>
<body class="page" style="margin:0;padding:0;background:${COLOR.page};">
<div style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">${esc(preheader)}${"&zwnj;&nbsp;".repeat(70)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="page" bgcolor="${COLOR.page}" style="background:${COLOR.page};"><tr><td align="center" style="padding:24px 12px 40px;">
<table role="presentation" class="wrap" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;">
<tr><td bgcolor="${COLOR.band}" style="background:${COLOR.band};border-radius:12px 12px 0 0;padding:20px 32px;" align="left"><a href="${esc(site)}" style="text-decoration:none;"><img src="${esc(site)}/brand/gz-email-logo.png" width="80" height="72" alt="GalleryZone" style="display:block;border:0;font:400 22px/1.2 ${SERIF};color:${COLOR.bandInk};"></a></td></tr>
<tr><td class="card pad" bgcolor="${COLOR.card}" style="background:${COLOR.card};padding:36px 40px 34px;border:1px solid ${COLOR.line};border-top:0;border-radius:0 0 12px 12px;">
<h1 class="h tx" style="margin:0 0 20px;font:400 28px/1.25 ${SERIF};color:${COLOR.ink};">${esc(l.heading)}</h1>
${l.paragraphs.map(paragraph).join("\n")}
${l.details?.length ? details(l.details) : ""}${l.note ? note(l.note) : ""}${l.cta ? button(l.cta) : ""}${l.footnote ? `<p class="mu" style="margin:22px 0 0;font:400 13px/1.55 ${SANS};color:${COLOR.muted};">${asHtml(l.footnote)}</p>` : ""}
</td></tr>
<tr><td align="center" style="padding:22px 16px 0;">
<p class="mu" style="margin:0 0 10px;font:400 12px/1.6 ${SANS};color:${COLOR.muted};">${esc(reason)}</p>
${footerLine}<p class="mu" style="margin:0;font:400 12px/1.6 ${SANS};color:${COLOR.muted};">${COMPANY} &nbsp;·&nbsp; <a class="lk" href="${esc(site)}" style="color:${COLOR.link};">${esc(site.replace(/^https?:\/\//, ""))}</a></p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

  const lines: string[] = [l.heading, ""];
  for (const p of l.paragraphs) lines.push(asText(p), "");
  if (l.details?.length) lines.push(...l.details.map(([label, value]) => `${label}: ${asText(value)}`), "");
  if (l.note) lines.push(`${l.note.label}: ${l.note.text}`, "");
  if (l.cta) lines.push(`${l.cta.label}: ${l.cta.url}`, "");
  if (l.footnote) lines.push(asText(l.footnote), "");
  lines.push("--", reason, ...links.map((x) => `${x.label}: ${x.url}`), `${COMPANY} · ${site.replace(/^https?:\/\//, "")}`);

  return { html, text: lines.join("\n") };
}
