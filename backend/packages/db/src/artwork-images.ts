// Artwork images — the Firestore side. Objects live in a private
// S3-compatible bucket (Railway); this module owns the metadata under
// artworks/{id}/images and the ownership rules. The bucket itself
// (presigning, HEAD, delete) is the API's storage adapter — Firestore
// never sees credentials.
//
// Flow: artist asks for an upload slot → browser PUTs straight to the
// bucket with the presigned URL → artist confirms → we verify the object
// exists with the declared type/size, write the metadata doc, and refresh
// the listing projection so the cover shows up.

import type { Firestore } from "firebase-admin/firestore";
import { Collections, artworkImagesCol, type ArtworkDoc, type ArtworkImageDoc } from "./collections.ts";
import { refreshListing } from "./listing-projection.ts";

export class ArtworkImageError extends Error {}

export const MAX_IMAGES_PER_ARTWORK = 8;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

const EXT: Record<ImageContentType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface ArtworkImage extends ArtworkImageDoc {
  id: string;
}

/** Object key for a new image — random suffix so a re-upload never collides and the URL can be cached forever. */
export function newImageKey(artworkId: string, contentType: ImageContentType): string {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `artworks/${artworkId}/${rand}.${EXT[contentType]}`;
}

/** The public URL the API serves this object at — the proxy route with immutable caching. */
export function imageUrlFor(apiBaseUrl: string, key: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/v1/images/${key}`;
}

/** Throws a not-found-shaped error unless the artwork exists and belongs to the artist. */
export async function assertArtworkOwnedBy(db: Firestore, artworkId: string, artistId: string): Promise<ArtworkDoc> {
  const snap = await db.collection(Collections.artworks).doc(artworkId).get();
  const artwork = snap.data() as ArtworkDoc | undefined;
  // 404-shaped either way: don't tell a stranger the id exists.
  if (!artwork || artwork.artistId !== artistId) throw new ArtworkImageError(`No artwork ${artworkId}`);
  return artwork;
}

export async function listArtworkImages(db: Firestore, artworkId: string): Promise<ArtworkImage[]> {
  const snap = await db.collection(artworkImagesCol(artworkId)).orderBy("sortOrder", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ArtworkImageDoc) }));
}

/** Checks the artist may add another image and returns the key to upload to. */
export async function reserveImageSlot(
  db: Firestore,
  { artworkId, artistId, contentType }: { artworkId: string; artistId: string; contentType: ImageContentType },
): Promise<{ key: string }> {
  await assertArtworkOwnedBy(db, artworkId, artistId);
  const existing = await db.collection(artworkImagesCol(artworkId)).count().get();
  if (existing.data().count >= MAX_IMAGES_PER_ARTWORK) {
    throw new ArtworkImageError(`An artwork can have at most ${MAX_IMAGES_PER_ARTWORK} images`);
  }
  return { key: newImageKey(artworkId, contentType) };
}

/** Records an uploaded object as an image of the artwork. `verified` is what the API found with a HEAD on the object. */
export async function confirmImage(
  db: Firestore,
  input: { artworkId: string; artistId: string; key: string; url: string; altText?: string | undefined },
): Promise<ArtworkImage> {
  await assertArtworkOwnedBy(db, input.artworkId, input.artistId);
  if (!input.key.startsWith(`artworks/${input.artworkId}/`)) throw new ArtworkImageError("Key does not belong to this artwork");

  const col = db.collection(artworkImagesCol(input.artworkId));
  const dup = await col.where("storagePath", "==", input.key).limit(1).get();
  if (!dup.empty) return { id: dup.docs[0]!.id, ...(dup.docs[0]!.data() as ArtworkImageDoc) };

  const existing = await col.count().get();
  if (existing.data().count >= MAX_IMAGES_PER_ARTWORK) {
    throw new ArtworkImageError(`An artwork can have at most ${MAX_IMAGES_PER_ARTWORK} images`);
  }
  const doc: ArtworkImageDoc = {
    url: input.url,
    thumbnailUrl: null,
    altText: input.altText ?? null,
    sortOrder: existing.data().count,
    storagePath: input.key,
  };
  const ref = await col.add(doc);
  await refreshListing(db, input.artworkId);
  return { id: ref.id, ...doc };
}

/** Removes the metadata doc and re-packs sortOrder; returns the object key for the API to delete from the bucket. */
export async function removeImage(
  db: Firestore,
  { artworkId, artistId, imageId }: { artworkId: string; artistId: string; imageId: string },
): Promise<{ key: string }> {
  await assertArtworkOwnedBy(db, artworkId, artistId);
  const ref = db.collection(artworkImagesCol(artworkId)).doc(imageId);
  const snap = await ref.get();
  if (!snap.exists) throw new ArtworkImageError(`No image ${imageId}`);
  const key = (snap.data() as ArtworkImageDoc).storagePath;
  await ref.delete();

  const rest = await listArtworkImages(db, artworkId);
  const batch = db.batch();
  rest.forEach((img, i) => {
    if (img.sortOrder !== i) batch.update(db.collection(artworkImagesCol(artworkId)).doc(img.id), { sortOrder: i });
  });
  await batch.commit();
  await refreshListing(db, artworkId);
  return { key };
}

/** New order = the full list of image ids; index 0 becomes the cover. */
export async function reorderImages(
  db: Firestore,
  { artworkId, artistId, imageIds }: { artworkId: string; artistId: string; imageIds: string[] },
): Promise<ArtworkImage[]> {
  await assertArtworkOwnedBy(db, artworkId, artistId);
  const current = await listArtworkImages(db, artworkId);
  const currentIds = new Set(current.map((i) => i.id));
  if (imageIds.length !== current.length || imageIds.some((id) => !currentIds.has(id)) || new Set(imageIds).size !== imageIds.length) {
    throw new ArtworkImageError("imageIds must be exactly the artwork's images, each once");
  }
  const batch = db.batch();
  imageIds.forEach((id, i) => batch.update(db.collection(artworkImagesCol(artworkId)).doc(id), { sortOrder: i }));
  await batch.commit();
  await refreshListing(db, artworkId);
  return listArtworkImages(db, artworkId);
}
