import type { Firestore } from "firebase-admin/firestore";
import { Collections, type GallerySpaceDoc } from "./collections.ts";

export interface GallerySpaceInput {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  capacity?: number | undefined;
  coordinatorName?: string | undefined;
}

export async function listGallerySpaces(db: Firestore, aggregatorId: string): Promise<(GallerySpaceDoc & { id: string })[]> {
  const snap = await db.collection(Collections.gallerySpaces).where("aggregatorId", "==", aggregatorId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as GallerySpaceDoc) }));
}

export async function addGallerySpace(db: Firestore, aggregatorId: string, input: GallerySpaceInput): Promise<{ id: string }> {
  const ref = db.collection(Collections.gallerySpaces).doc();
  const doc: GallerySpaceDoc = {
    aggregatorId,
    name: input.name,
    addressLine1: input.addressLine1,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    capacity: input.capacity ?? null,
    coordinatorName: input.coordinatorName ?? null,
  };
  await ref.set(doc);
  return { id: ref.id };
}
