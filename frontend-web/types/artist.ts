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
}

export function verifiedTierCount(v: ArtistVerificationState): 0 | 1 | 2 | 3 {
  return [v.tier1SocialMedia, v.tier2ActivePlan, v.tier3FirstSale].filter(
    Boolean,
  ).length as 0 | 1 | 2 | 3;
}
