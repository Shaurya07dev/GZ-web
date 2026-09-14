// The artist's own artworks on the real API — list, one, submit, edit —
// including the image pipeline: the browser asks the API for a presigned
// PUT, uploads the file straight to the storage bucket, then confirms.
// artistDashboardService delegates its artwork methods here so the mock
// file shrinks instead of growing.

import type { Artwork, ArtworkImage, ArtworkPhysical, ArtworkStatus, InsuranceStatus } from "@/types/artwork";
import { http } from "@/lib/api";
import { paiseToRupees, toArtwork, type ArtworkDto } from "@/lib/api-mappers";

/** Mirrors backend OwnerArtworkView (packages/db/artist-artworks.ts). */
export interface OwnerArtworkDto extends ArtworkDto {
  artistPricePaise: number;
  artistNet: { marketplace: number; aggregatorEstimate: number };
  images: (ArtworkDto["images"][number] & { id: string; storagePath: string })[];
  statusHistory: { status: ArtworkStatus; changedAt: string; reason: string | null }[];
  insuranceOpted: boolean;
  insuranceNumber: string | null;
  insuranceStatus: string | null;
  nfcTagId: string | null;
  artworkType: string | null;
  paintingStyle: string | null;
  physical: ArtworkPhysical | null;
  editableUntil: string;
}

export type OwnerArtwork = Artwork & {
  artistPrice: number;
  artistNet: { marketplace: number; aggregatorEstimate: number };
  editableUntil: string;
  /** Image ids, in display order — needed to edit/reorder. */
  imageIds: string[];
};

const INSURANCE_STATUS: Record<string, InsuranceStatus> = {
  not_submitted: "not_submitted",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
};

export function toOwnerArtwork(dto: OwnerArtworkDto): OwnerArtwork {
  const base = toArtwork(dto);
  return {
    ...base,
    artistPrice: paiseToRupees(dto.artistPricePaise),
    artistNet: { marketplace: paiseToRupees(dto.artistNet.marketplace), aggregatorEstimate: paiseToRupees(dto.artistNet.aggregatorEstimate) },
    insured: dto.insuranceOpted || dto.insured,
    insuranceNumber: dto.insuranceNumber,
    insuranceStatus: dto.insuranceStatus ? INSURANCE_STATUS[dto.insuranceStatus] : "not_submitted",
    nfcTagId: dto.nfcTagId,
    artworkType: dto.artworkType,
    paintingStyle: dto.paintingStyle,
    physical: dto.physical,
    statusHistory: dto.statusHistory.length ? dto.statusHistory.map((e) => ({ status: e.status, changedAt: e.changedAt, reason: e.reason ?? undefined })) : base.statusHistory,
    editableUntil: dto.editableUntil,
    imageIds: [...dto.images].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => i.id),
  };
}

/** An image the form holds: either a new File to upload, or one already on the artwork. */
export interface SubmitImage {
  /** Local preview URL (object URL for new files, the API URL for existing). */
  url: string;
  altText: string;
  file?: File;
  imageId?: string;
}

export interface ArtworkWritePayload {
  title: string;
  description: string;
  category: string;
  medium: string;
  artworkType: string | null;
  paintingStyle: string | null;
  dimensions: string | null;
  yearCreated: number;
  artistPrice: number;
  listingType: Artwork["listingType"];
  insuranceOpted: boolean;
  insuranceNumber: string | null;
  physical: ArtworkPhysical;
  nfcTagId: string | null;
  images: SubmitImage[];
}

function toBody(p: Omit<ArtworkWritePayload, "images">, mode?: "draft" | "review") {
  return {
    title: p.title,
    description: p.description,
    category: p.category,
    medium: p.medium,
    artistPricePaise: Math.round(p.artistPrice * 100),
    listingType: p.listingType,
    ...(p.dimensions ? { dimensions: p.dimensions } : {}),
    yearCreated: p.yearCreated,
    ...(mode ? { mode } : {}),
    artworkType: p.artworkType,
    paintingStyle: p.paintingStyle,
    insuranceOpted: p.insuranceOpted,
    insuranceNumber: p.insuranceNumber,
    nfcTagId: p.nfcTagId,
    physical: p.physical,
  };
}

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

async function uploadOne(artworkId: string, image: SubmitImage): Promise<string> {
  const file = image.file!;
  if (!ACCEPTED.has(file.type)) throw new Error(`${file.name}: only JPEG, PNG or WebP images are accepted`);
  const slot = await http.post<{ key: string; uploadUrl: string; headers: Record<string, string> }>(
    `/v1/artist/artworks/${encodeURIComponent(artworkId)}/images/upload-url`,
    { contentType: file.type, contentLength: file.size },
  );
  const put = await fetch(slot.uploadUrl, { method: "PUT", headers: slot.headers, body: file });
  if (!put.ok) throw new Error(`${file.name}: upload failed (${put.status})`);
  const confirmed = await http.post<{ id: string }>(`/v1/artist/artworks/${encodeURIComponent(artworkId)}/images/confirm`, {
    key: slot.key,
    altText: image.altText,
  });
  return confirmed.id;
}

/** Brings the artwork's images in line with the form: delete removed ones, upload new ones, then apply the order. */
async function syncImages(artworkId: string, images: SubmitImage[], existingIds: string[]): Promise<void> {
  const keep = new Set(images.map((i) => i.imageId).filter((id): id is string => !!id));
  for (const id of existingIds) {
    if (!keep.has(id)) await http.delete(`/v1/artist/artworks/${encodeURIComponent(artworkId)}/images/${encodeURIComponent(id)}`);
  }
  const finalIds: string[] = [];
  for (const image of images) {
    if (image.imageId) finalIds.push(image.imageId);
    else if (image.file) finalIds.push(await uploadOne(artworkId, image));
  }
  const unchanged = finalIds.length === existingIds.length && finalIds.every((id, i) => id === existingIds[i]);
  if (finalIds.length > 1 && !unchanged) {
    await http.put(`/v1/artist/artworks/${encodeURIComponent(artworkId)}/images/order`, { imageIds: finalIds });
  }
}

export const artistArtworkApi = {
  async list(): Promise<OwnerArtwork[]> {
    const { artworks } = await http.get<{ artworks: OwnerArtworkDto[] }>("/v1/artist/artworks");
    return artworks.map(toOwnerArtwork);
  },

  async get(artworkId: string): Promise<OwnerArtwork> {
    return toOwnerArtwork(await http.get<OwnerArtworkDto>(`/v1/artist/artworks/${encodeURIComponent(artworkId)}`));
  },

  async submit(input: ArtworkWritePayload & { mode: "draft" | "review" }): Promise<OwnerArtwork> {
    const { images, mode, ...rest } = input;
    const created = await http.post<OwnerArtworkDto>("/v1/artist/artworks", toBody(rest, mode));
    await syncImages(created.id, images, []);
    return artistArtworkApi.get(created.id);
  },

  async update(input: { artworkId: string; patch: ArtworkWritePayload; mode?: "draft" | "review" }): Promise<OwnerArtwork> {
    const current = await artistArtworkApi.get(input.artworkId);
    const { images, ...rest } = input.patch;
    await http.patch<OwnerArtworkDto>(`/v1/artist/artworks/${encodeURIComponent(input.artworkId)}`, toBody(rest, input.mode));
    await syncImages(input.artworkId, images, current.imageIds);
    return artistArtworkApi.get(input.artworkId);
  },
};

export type { ArtworkImage };
