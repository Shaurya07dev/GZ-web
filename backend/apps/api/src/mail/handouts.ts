// Handout attachments — the 10 client-written PDFs/PPTs we attach to
// specific lifecycle emails. Loaded once at module boot, kept in memory,
// handed to the Mailer as { filename, content, contentType } attachments.
//
// Rules:
//   • A missing file at module boot is fatal — ship-blocker rather than a
//     silent "attached nothing" email that goes out without the client's
//     intended guide.
//   • Content type is sniffed from the extension (.pdf / .pptx); unknown
//     extensions default to application/octet-stream which every client
//     will download rather than inline-render.
//   • The slug (first arg to handoutAttachment) is the key callers pass
//     in — not the filename on disk — so renaming a handout version-
//     bump touches one line here, not every call site.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type HandoutSlug =
  // --- Artist lifecycle ---
  | "artist-signin-walkthrough"
  | "artist-list-artwork"
  | "sell-marketplace-pathA"
  | "display-aggregator-pathB"
  | "transfer-rights"
  // --- Aggregator lifecycle ---
  | "aggregator-signup-lifecycle"
  | "aggregator-reservation-detail"
  | "aggregator-sale-detail"
  | "display-day-20"
  | "display-day-30";

/** Canonical filenames on disk. Version-bump a handout by updating the
 *  filename here and dropping the new file into assets/email-handouts. */
const HANDOUTS: Record<HandoutSlug, string> = {
  "artist-signin-walkthrough":
    "GalleryZone_Artist_Guide_Interactive_Walkthrough_v3.pptx",
  "artist-list-artwork":
    "GalleryZone_Artist_Purchase_List_and_Steps_4_to_6.pptx",
  "sell-marketplace-pathA":
    "GalleryZone_PathA_Sell_On_Marketplace_Guide_v3.pptx",
  "display-aggregator-pathB":
    "GalleryZone_PathB_Display_Through_Aggregators_Handout.pdf",
  "transfer-rights":
    "GalleryZone_Transfer_Rights_Interactive_Guide_v4.pptx",
  "aggregator-signup-lifecycle":
    "Galleryzone_Aggregator_8_Step_Lifecycle-v2.pptx",
  "aggregator-reservation-detail":
    "Galleryzone_Aggregator_Steps_3_to_8_Detailed.pptx",
  "aggregator-sale-detail":
    "Galleryzone_Aggregator_Steps_7_and_8_Detailed.pptx",
  "display-day-20":
    "Galleryzone_Next_Reservation_Transfer_and_Packaging_SOP-v3.pptx",
  "display-day-30":
    "Galleryzone_Next_Reservation_Transfer_and_Packaging_SOP.pptx",
};

const HANDOUT_DIR = resolve(
  import.meta.dirname,
  "..",
  "..",
  "assets",
  "email-handouts",
);

function mimeFor(filename: string): string {
  if (filename.endsWith(".pdf")) return "application/pdf";
  if (filename.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return "application/octet-stream";
}

interface CachedHandout {
  filename: string;
  content: Buffer;
  contentType: string;
}

const cache = new Map<HandoutSlug, CachedHandout>();

/** Load a single handout. The first call reads from disk; later calls
 *  return the cached buffer. Throws if the file is missing — a missing
 *  handout is a deployment error, not something to swallow. */
export function handoutAttachment(slug: HandoutSlug): CachedHandout {
  const hit = cache.get(slug);
  if (hit) return hit;
  const filename = HANDOUTS[slug];
  const fullPath = resolve(HANDOUT_DIR, filename);
  let content: Buffer;
  try {
    content = readFileSync(fullPath);
  } catch (err) {
    throw new Error(
      `Handout "${slug}" (${filename}) is missing from ${HANDOUT_DIR}. Drop the file in that directory and restart the server. Original: ${String(err)}`,
    );
  }
  const loaded = { filename, content, contentType: mimeFor(filename) };
  cache.set(slug, loaded);
  return loaded;
}

/** Called at boot to prove every handout in HANDOUTS resolves to a real
 *  file. Keeps the "silent attach-nothing" class of bug from ever
 *  surviving a deploy. */
export function assertAllHandoutsLoadable(): void {
  for (const slug of Object.keys(HANDOUTS) as HandoutSlug[]) {
    handoutAttachment(slug);
  }
}
