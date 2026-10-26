import assert from "node:assert/strict";
import { publicArtistFields } from "./public-profiles.ts";
import type { PublicProfileDoc } from "./collections.ts";

const profile: PublicProfileDoc = {
  name: "Meera Nair",
  headline: "Painter",
  bio: "Studio practice",
  location: "Kochi",
  profileImageUrl: null,
  website: "meera.example/works",
  socialProofVideoUrl: "https://youtu.be/process-video",
  tier1SocialMedia: true,
  tier2ArtistAgreement: true,
  tier3FirstSale: false,
};

assert.deepEqual(publicArtistFields(profile), {
  name: "Meera Nair",
  headline: "Painter",
  bio: "Studio practice",
  location: "Kochi",
  profileImageUrl: null,
  verification: {
    tier1SocialMedia: true,
    tier2ActivePlan: true,
    tier3FirstSale: false,
  },
  socialLinks: [
    { platform: "website", url: "https://meera.example/works" },
    { platform: "youtube", url: "https://youtu.be/process-video" },
  ],
});

const legacy: PublicProfileDoc = {
  name: "Legacy Artist",
  headline: null,
  bio: null,
  location: null,
  profileImageUrl: null,
};

assert.deepEqual(publicArtistFields(legacy).verification, {
  tier1SocialMedia: false,
  tier2ActivePlan: false,
  tier3FirstSale: false,
});
assert.deepEqual(publicArtistFields(legacy).socialLinks, []);

const unsafe: PublicProfileDoc = {
  ...legacy,
  website: "javascript:alert(1)",
  socialProofVideoUrl: "not a URL",
};
assert.deepEqual(publicArtistFields(unsafe).socialLinks, []);

console.log("public profile checks passed");
