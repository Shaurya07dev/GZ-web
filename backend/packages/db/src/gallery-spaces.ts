import { eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { gallerySpaces } from "./schema/aggregator.ts";

export class GallerySpaceError extends Error {}

export interface GallerySpaceInput {
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  capacity?: number | undefined;
  coordinatorName?: string | undefined;
}

export async function listGallerySpaces(db: Db, aggregatorId: string) {
  return db.select().from(gallerySpaces).where(eq(gallerySpaces.aggregatorId, aggregatorId));
}

export async function addGallerySpace(db: Db, aggregatorId: string, input: GallerySpaceInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(gallerySpaces)
    .values({ aggregatorId, name: input.name, addressLine1: input.addressLine1, city: input.city, state: input.state, pincode: input.pincode, capacity: input.capacity ?? null, coordinatorName: input.coordinatorName ?? null })
    .returning({ id: gallerySpaces.id });
  if (!row) throw new GallerySpaceError("insert into gallery_spaces returned no row");
  return row;
}
