export interface ArtistSocialLink {
  platform: "instagram" | "youtube" | "x" | "tiktok";
  url: string;
}

export interface ArtistVerificationState {
  tier1SocialMedia: boolean;
  tier2ActivePlan: boolean;
  tier3FirstSale: boolean;
}

export interface ArtistProfile {
  id: string;
  name: string;
  bio: string; // sanitized rich text — render through DOMPurify at display time
  profileImageUrl: string;
  verification: ArtistVerificationState;
  socialLinks: ArtistSocialLink[];

  /**
   * One line, in plain words, of what they actually make. Sits under the name
   * on the public profile, where the bio is too long to help someone deciding
   * whether to keep reading.
   */
  headline: string;

  /** Where they work. City and state — never a street address. */
  location: string;

  /** On GalleryZone since. ISO. */
  joinedAt: string;
}

export function verifiedTierCount(v: ArtistVerificationState): 0 | 1 | 2 | 3 {
  return [v.tier1SocialMedia, v.tier2ActivePlan, v.tier3FirstSale].filter(
    Boolean,
  ).length as 0 | 1 | 2 | 3;
}
