// Escape-safe text for emails.
//
// The first templates passed strings that were already HTML, and the layout
// escaped some of them a second time: a name like "Priya & Co" came out as
// "Priya &amp; Co" in the heading, and the plain-text part carried raw
// entities ("Krishna&#39;s Flute"). Here a plain string is always text and is
// escaped exactly once, where it is written. Markup can only be made with the
// helpers below, which escape whatever goes into them, and every piece carries
// its plain-text twin, so the text part never has to be recovered from HTML.

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Authored markup together with the plain text it reads as. */
export class Rich {
  readonly html: string;
  readonly text: string;
  // Written out, not as parameter properties: the check scripts run under
  // Node's type stripping, which cannot compile those.
  constructor(html: string, text: string) {
    this.html = html;
    this.text = text;
  }
}

export type Part = string | number | Rich;

export const asHtml = (p: Part): string => (p instanceof Rich ? p.html : esc(String(p)));
export const asText = (p: Part): string => (p instanceof Rich ? p.text : String(p));

/** Template tag: strings and numbers are escaped, `Rich` values pass through untouched. */
export function rich(strings: TemplateStringsArray, ...values: Part[]): Rich {
  let html = "";
  let text = "";
  strings.forEach((s, i) => {
    html += esc(s);
    text += s;
    const v = values[i];
    if (i < values.length && v !== undefined) {
      html += asHtml(v);
      text += asText(v);
    }
  });
  return new Rich(html, text);
}

export const strong = (p: Part): Rich => new Rich(`<strong>${asHtml(p)}</strong>`, asText(p));
export const em = (p: Part): Rich => new Rich(`<em>${asHtml(p)}</em>`, asText(p));
