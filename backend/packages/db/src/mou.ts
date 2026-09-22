// Memorandum of Understanding acceptance — the signed record behind the
// artist and aggregator MOU screens. One doc per (user, version) under
// users/{uid}/mouAcceptances/{version}; the server clock is the time of
// signing, never the browser's. A new MOU version means a new acceptance —
// the frontend treats any acceptance whose version isn't the current one
// as "not signed", so publishing a new version forces a re-sign.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { Collections, type UserDoc } from "./collections.ts";
import { DbError } from "./errors.ts";

export class MouError extends DbError {}

export type MouParty = "artist" | "aggregator";

export interface MouAcceptanceDoc {
  party: MouParty;
  version: string;
  signatureName: string;
  /** PNG data URL of the drawn signature; null when signed by typed name only. */
  signatureDataUrl: string | null;
  acceptedAt: FirebaseFirestore.Timestamp;
}

export interface MouAcceptance {
  party: MouParty;
  version: string;
  signatureName: string;
  signatureDataUrl: string | null;
  acceptedAt: Date;
}

export const mouAcceptancesCol = (uid: string) => `${Collections.users}/${uid}/mouAcceptances`;

// A drawn signature is a small PNG; anything near Firestore's 1 MiB doc
// limit is not a signature.
const MAX_SIGNATURE_BYTES = 300_000;

export async function recordMouAcceptance(
  db: Firestore,
  input: { uid: string; party: MouParty; version: string; signatureName: string; signatureDataUrl?: string | null | undefined },
): Promise<MouAcceptance> {
  const userSnap = await db.collection(Collections.users).doc(input.uid).get();
  const user = userSnap.data() as UserDoc | undefined;
  if (!user) throw new MouError(`No user ${input.uid}`);

  const signatureName = input.signatureName.trim();
  if (!signatureName) throw new MouError("Type your full name to sign");
  if (signatureName.toLowerCase() !== user.name.trim().toLowerCase()) {
    throw new MouError("The signature must match the name on your profile");
  }
  const signatureDataUrl = input.signatureDataUrl ?? null;
  if (signatureDataUrl && (!signatureDataUrl.startsWith("data:image/png;base64,") || signatureDataUrl.length > MAX_SIGNATURE_BYTES)) {
    throw new MouError("The drawn signature must be a small PNG");
  }

  const ref = db.collection(mouAcceptancesCol(input.uid)).doc(input.version);
  // Re-signing the same version keeps the ORIGINAL time — a signature isn't
  // something you refresh.
  const existing = await ref.get();
  if (existing.exists) return toAcceptance(existing.data() as MouAcceptanceDoc);

  const doc: MouAcceptanceDoc = {
    party: input.party,
    version: input.version,
    signatureName,
    signatureDataUrl,
    acceptedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
  await ref.set(doc);
  return toAcceptance((await ref.get()).data() as MouAcceptanceDoc);
}

/** The most recent acceptance for this party, or null. */
export async function getLatestMouAcceptance(db: Firestore, uid: string, party: MouParty): Promise<MouAcceptance | null> {
  const snap = await db.collection(mouAcceptancesCol(uid)).where("party", "==", party).get();
  const docs = snap.docs.map((d) => toAcceptance(d.data() as MouAcceptanceDoc)).sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime());
  return docs[0] ?? null;
}

function toAcceptance(doc: MouAcceptanceDoc): MouAcceptance {
  return {
    party: doc.party,
    version: doc.version,
    signatureName: doc.signatureName,
    signatureDataUrl: doc.signatureDataUrl,
    acceptedAt: doc.acceptedAt?.toDate() ?? new Date(0),
  };
}
