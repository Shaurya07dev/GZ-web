import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("../../docs/legal/artist-mou-2026.2.txt", import.meta.url), "utf8").replace(/\r/g, "");
const lines = src.split("\n").map((l) => l.trim()).filter(Boolean);
const clauses = [];
let cur = null; let declaration = []; let mode = "head"; let preamble = [];
for (const l of lines) {
  if (/^_{5,}$/.test(l)) continue;
  const h = l.match(/^(\d+)\.\s+([A-Z][A-Z ,&/'-]+)$/);
  if (h) { cur = { number: +h[1], title: h[2], blocks: [] }; clauses.push(cur); mode = "clause"; continue; }
  if (/^DECLARATION$/.test(l)) { mode = "decl"; continue; }
  if (/^FOR GALLERYZONE PRIVATE LIMITED$/.test(l)) { mode = "sig"; continue; }
  if (mode === "head") { if (/^Galleryzone and the Artist are/.test(l)) preamble.push(l); continue; }
  if (mode === "sig") continue;
  const item = l.match(/^([a-z]|[ivx]+)\.\s+(.*)$/);
  if (mode === "decl") { if (item) declaration.push(item[2]); continue; }
  if (item) {
    const last = cur.blocks[cur.blocks.length - 1];
    if (last && last.type === "list") last.items.push(item[2]); else cur.blocks.push({ type: "list", items: [item[2]] });
  } else cur.blocks.push({ type: "paragraph", text: l });
}
const title = (t) => t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/\bOf\b/g, "of").replace(/\bBefore\b/g, "Before");
const esc = (s) => JSON.stringify(s);
let out = `// The artist's Memorandum of Understanding with GalleryZone. GENERATED from
// docs/legal/artist-mou-2026.2.txt by frontend-web/scripts/gen-mou.mjs —
// do not hand-edit; fix the source document and regenerate, so the screen,
// the PDF and the paper version can never say different things.
//
// Publishing a new version (bump MOU_VERSION) forces every artist to re-sign;
// the signing time recorded is the server's clock at the moment of signing.

import type { MouDocument } from "@/features/mou/mou-agreement";

export const MOU_VERSION = "2026.2";

export const MOU_PREAMBLE = [
  "This Memorandum of Understanding is entered into between Galleryzone Private Limited (“Galleryzone”, “the Company”, or “the Platform”) and the Artist.",
  ${esc(preamble[0])},
];

export const ARTIST_MOU: MouDocument = {
  title: "Memorandum of Understanding",
  version: MOU_VERSION,
  intro: "Your overall agreement with GalleryZone. Read it in full, then sign.",
  preamble: MOU_PREAMBLE,
  clauses: [
`;
for (const c of clauses) {
  out += `    {\n      number: ${c.number},\n      title: ${esc(title(c.title.trim()))},\n      blocks: [\n`;
  for (const b of c.blocks) {
    if (b.type === "paragraph") out += `        { type: "paragraph", text: ${esc(b.text)} },\n`;
    else out += `        {\n          type: "list",\n          items: [\n${b.items.map((i) => `            ${esc(i)},\n`).join("")}          ],\n        },\n`;
  }
  out += `      ],\n    },\n`;
}
out += `  ],\n  declaration: [\n${declaration.map((d) => `    ${esc(d)},\n`).join("")}  ],\n};\n`;
writeFileSync(new URL("../features/dashboard/mou-data.ts", import.meta.url), out);
console.log(clauses.length, "clauses;", declaration.length, "declaration items; preamble:", preamble.length);
