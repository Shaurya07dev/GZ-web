import Image from "next/image";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import {
  InstagramGlyph,
  TiktokGlyph,
  XGlyph,
  YoutubeGlyph,
} from "@/components/social-icons";
import { verifiedTierCount } from "@/types/artist";
import type { ArtistProfile, ArtistSocialLink } from "@/types/artist";

const SOCIAL_ICON: Record<ArtistSocialLink["platform"], typeof InstagramGlyph> =
  {
    instagram: InstagramGlyph,
    youtube: YoutubeGlyph,
    x: XGlyph,
    tiktok: TiktokGlyph,
  };

const SOCIAL_LABEL: Record<ArtistSocialLink["platform"], string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

// Restates what the verification tier actually means for a general
// audience — the badge itself only ever shows "Verified" or "Gold ✦
// Verified", this sentence is the one place on the public profile that
// spells out the tier count in words.
function verificationSummary(artist: ArtistProfile): string {
  const tierCount = verifiedTierCount(artist.verification);
  if (tierCount === 3) {
    return "Gold ✦ Verified: completed social media, active plan, and first-sale verification.";
  }
  if (tierCount > 0) {
    return `Verified: ${tierCount} of 3 verification tiers complete.`;
  }
  return "This artist is completing their GalleryZone verification.";
}

interface ArtistProfileHeaderProps {
  artist: ArtistProfile;
}

export function ArtistProfileHeader({ artist }: ArtistProfileHeaderProps) {
  return (
    <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-gold/30 sm:size-28">
        <Image
          src={artist.profileImageUrl}
          alt={artist.name}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col items-center gap-2 sm:items-start">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {artist.name}
          </h1>
          <VerifiedBadge verification={artist.verification} />
        </div>

        <p className="max-w-md text-sm text-muted-foreground">
          {verificationSummary(artist)}
        </p>

        {artist.socialLinks.length > 0 && (
          <div className="mt-1 flex items-center gap-2">
            {artist.socialLinks.map((link) => {
              const Icon = SOCIAL_ICON[link.platform];
              return (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${artist.name} on ${SOCIAL_LABEL[link.platform]}`}
                  className="flex size-9 items-center justify-center rounded-md border border-border text-foreground/80 transition-colors hover:border-gold/50 hover:text-gold-bright"
                >
                  <Icon className="size-4" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
