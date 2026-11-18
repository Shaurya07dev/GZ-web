// The one "Get in touch" form (client, 18 Nov 2026): advertisement, collaboration, general question or support all
// arrive here, each tagged with its type, so the admin reads them in one place and filters by type.
//
// The public site has no login on this form, so the write is open (rate-limited in the controller); everything
// else (listing, marking handled) is admin-only.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { Collections, type EnquiryDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class EnquiryError extends DbError {}

export const enquiryTypes = ["advertisement", "collaboration", "general", "support"] as const;
export type EnquiryType = (typeof enquiryTypes)[number];

export const enquiryStatuses = ["new", "handled"] as const;
export type EnquiryStatus = (typeof enquiryStatuses)[number];

export const enquirySenderRoles = ["artist", "aggregator", "collector"] as const;

export const ENQUIRY_MESSAGE_MAX = 2000;

export interface EnquiryView {
  id: string;
  type: EnquiryType;
  name: string;
  email: string;
  senderRole: string;
  message: string;
  status: EnquiryStatus;
  createdAt: string;
  handledAt: string | null;
}

export interface NewEnquiry {
  type: EnquiryType;
  name: string;
  email: string;
  senderRole: string;
  message: string;
}

/** Trims and checks one enquiry; the controller's schema has already shaped it, this is the rule of the house. Pure. */
export function cleanEnquiry(input: NewEnquiry): NewEnquiry {
  const clean = {
    type: input.type,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    senderRole: input.senderRole,
    message: input.message.trim(),
  };
  if (!enquiryTypes.includes(clean.type)) throw new EnquiryError("Choose what your message is about");
  if (!clean.name) throw new EnquiryError("Enter your name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new EnquiryError("Enter a valid email address");
  if (!clean.message) throw new EnquiryError("Write your message");
  if (clean.message.length > ENQUIRY_MESSAGE_MAX) throw new EnquiryError(`Keep your message under ${ENQUIRY_MESSAGE_MAX} characters`);
  return clean;
}

export async function submitEnquiry(db: Firestore, input: NewEnquiry): Promise<{ id: string }> {
  const clean = cleanEnquiry(input);
  const doc: EnquiryDoc = {
    ...clean,
    status: "new",
    createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    handledAt: null,
    handledBy: null,
  };
  const ref = await db.collection(Collections.enquiries).add(doc);
  return { id: ref.id };
}

const iso = (t: FirebaseFirestore.Timestamp | null | undefined): string | null => (t && typeof t.toDate === "function" ? t.toDate().toISOString() : null);

/** Newest first; optionally only one type and/or one status. Filtering is done here, not in Firestore, so no index is needed. */
export async function listEnquiries(
  db: Firestore,
  filter: { type?: EnquiryType | undefined; status?: EnquiryStatus | undefined } = {},
  limit = 300,
): Promise<EnquiryView[]> {
  const snap = await db.collection(Collections.enquiries).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs
    .map((d) => {
      const doc = d.data() as EnquiryDoc;
      return {
        id: d.id,
        type: doc.type,
        name: doc.name,
        email: doc.email,
        senderRole: doc.senderRole,
        message: doc.message,
        status: doc.status,
        createdAt: iso(doc.createdAt) ?? new Date(0).toISOString(),
        handledAt: iso(doc.handledAt),
      } satisfies EnquiryView;
    })
    .filter((e) => (!filter.type || e.type === filter.type) && (!filter.status || e.status === filter.status));
}

/** How many of each type are still waiting, for the counts on the admin filter. */
export function countByType(enquiries: Pick<EnquiryView, "type" | "status">[]): Record<EnquiryType, number> {
  const counts: Record<EnquiryType, number> = { advertisement: 0, collaboration: 0, general: 0, support: 0 };
  for (const e of enquiries) if (e.status === "new") counts[e.type] += 1;
  return counts;
}

export async function setEnquiryStatus(db: Firestore, id: string, status: EnquiryStatus, adminId: string): Promise<void> {
  const ref = db.collection(Collections.enquiries).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new EnquiryError(`No enquiry ${id}`);
  await ref.update(
    status === "handled"
      ? { status, handledAt: FieldValue.serverTimestamp(), handledBy: adminId }
      : { status, handledAt: null, handledBy: null },
  );
}
