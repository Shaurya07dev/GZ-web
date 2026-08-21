"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Nfc } from "lucide-react";
import { CUSTODY_PARTY_LABEL, resolveCustody } from "@/types/artwork";
import { useArtwork } from "@/hooks/useArtwork";
import { useArtistProfile } from "@/hooks/useArtistProfile";
import { ArtworkPassportCard } from "./artwork-passport-card";
import { OwnershipHistory } from "./ownership-history";
import { ProvenanceTimeline } from "./provenance-timeline";

// Client-rendered (not the Server Component the marketplace detail page
// uses) so the passport for an artwork submitted and approved through the
// Artist Dashboard this session — which only exists in the browser's
// localStorage-backed mock-db, not in the seeded fixtures a server render
// can see — actually resolves instead of 404ing.
export function ArtworkPassportView({ artworkId }: { artworkId: string }) {
  const { data: artwork, isLoading } = useArtwork(artworkId);
  const { data: artist } = useArtistProfile(artwork?.artistId ?? "");

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-14 text-center text-sm text-muted-foreground">
        Loading passport…
      </div>
    );
  }

  if (!artwork) {
    notFound();
  }

  const custody = resolveCustody(artwork);
  const coverImage =
    [...artwork.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ??
    artwork.thumbnailUrl;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-14 lg:py-20">
      <Link
        href={`/marketplace/${artwork.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-gold-bright"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Back to listing
      </Link>

      <div className="mt-8">
        <ArtworkPassportCard
          title={artwork.title}
          artistName={artwork.artistName}
          coverImageUrl={coverImage}
          coaCertificateNumber={artwork.coaCertificateNumber}
          coaIssueDate={artwork.coaIssueDate}
        />
      </div>

      {artwork.nfcTagId && (
        <p className="mx-auto mt-6 flex max-w-md items-center justify-center gap-2 text-xs text-muted-foreground">
          <Nfc className="size-3.5 text-gold-bright" strokeWidth={1.75} />
          Physical tag <span className="font-mono">{artwork.nfcTagId}</span>
        </p>
      )}

      {/* Ownership, custody and location are three independent facts about a
          physical artwork — the passport shows all three rather than one
          collapsed "owner". */}
      <dl className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-border bg-card px-3 py-3">
          <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Owner
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {custody.legalOwnerName ?? CUSTODY_PARTY_LABEL[custody.legalOwner]}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-3">
          <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Held by
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {CUSTODY_PARTY_LABEL[custody.custodian]}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-3">
          <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Location
          </dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {custody.locationLabel}
          </dd>
        </div>
      </dl>

      <OwnershipHistory artworkId={artwork.id} artistName={artwork.artistName} />

      <div className="mx-auto mt-14 max-w-md">
        <ProvenanceTimeline history={artwork.statusHistory} />
      </div>

      {artist && (
        <p className="mx-auto mt-14 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
          Registered to{" "}
          <Link
            href={`/artists/${artist.id}`}
            className="font-medium text-gold-bright hover:underline"
          >
            {artist.name}
          </Link>
          , a verified GalleryZone artist.
        </p>
      )}
    </div>
  );
}
