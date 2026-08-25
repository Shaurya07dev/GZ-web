import type { ArtistProfile } from "@/types/artist";

// Seven artist profiles spanning every verification-tier combination the UI
// needs to render: two fully Gold-verified (all three tiers), one tier-1
// only, one tier-1 + tier-2, two unusual partial combinations, and one
// freshly registered artist with zero tiers complete. Bios are original
// short paragraphs written in the voice of the Onboarding Guide's marketing
// copy (empowerment + authenticity + process transparency), stored as
// sanitized-at-display rich text (simple <p> markup) per types/artist.ts.
export const mockArtists: ArtistProfile[] = [
  {
    id: "meera-nair",
    headline: "Oil painter · monsoon light on the Tamil coastline",
    location: "Kochi, Kerala",
    joinedAt: "2025-02-18T00:00:00.000Z",
    name: "Meera Nair",
    bio: "<p>Meera paints the Tamil Nadu coastline in the hours just before and after monsoon rain, working almost entirely in oil on canvas. Her practice began after a decade in textile design, and it shows in the way she builds colour in layered washes rather than single strokes.</p><p>Every canvas ships with a signed Certificate of Authenticity and a linked process video, and she has been part of GalleryZone's verified artist community since its earliest cohort.</p>",
    profileImageUrl: "/early-program/avatar-1.png",
    verification: {
      tier1SocialMedia: true,
      tier2ActivePlan: true,
      tier3FirstSale: true,
    },
    socialLinks: [
      { platform: "instagram", url: "https://www.instagram.com/meera.paints/" },
      { platform: "youtube", url: "https://www.youtube.com/@meeranairart" },
    ],
  },
  {
    id: "arjun-mehta",
    headline: "Sculptor · reclaimed marble and cast bronze",
    location: "Jaipur, Rajasthan",
    joinedAt: "2025-03-02T00:00:00.000Z",
    name: "Arjun Mehta",
    bio: "<p>Arjun works in reclaimed marble and cast bronze, drawing on four generations of stone-carving tradition in his family's workshop outside Jaipur. Each piece is hand-finished over several weeks, with no two ever repeated.</p><p>He documents the full process on video, from raw block to final polish, giving collectors a rare look at how the work is actually made. Fully verified on GalleryZone, with confirmed sales through both the open marketplace and partner aggregators.</p>",
    profileImageUrl: "/early-program/avatar-2.png",
    verification: {
      tier1SocialMedia: true,
      tier2ActivePlan: true,
      tier3FirstSale: true,
    },
    socialLinks: [
      {
        platform: "instagram",
        url: "https://www.instagram.com/arjunmehta.sculpture/",
      },
      { platform: "youtube", url: "https://www.youtube.com/@arjunmehtastudio" },
    ],
  },
  {
    id: "kavya-iyer",
    headline: "Fine-art photographer · film, hand-printed editions",
    location: "Bengaluru, Karnataka",
    joinedAt: "2026-05-14T00:00:00.000Z",
    name: "Kavya Iyer",
    bio: "<p>Kavya is a fine-art photographer working in limited-edition archival prints, documenting the single-screen cinemas of Bengaluru before they disappear. She shoots exclusively on film and hand-prints every edition in a small darkroom studio.</p><p>Newly listed on GalleryZone, with her Instagram linked for collectors who want to see new work as it's shot.</p>",
    profileImageUrl: "/early-program/avatar-4.png",
    verification: {
      tier1SocialMedia: true,
      tier2ActivePlan: false,
      tier3FirstSale: false,
    },
    socialLinks: [
      { platform: "instagram", url: "https://www.instagram.com/kavya.frames/" },
    ],
  },
  {
    id: "rohan-bhattacharya",
    headline: "Figurative painter · music, memory and colour",
    location: "Kolkata, West Bengal",
    joinedAt: "2025-09-12T00:00:00.000Z",
    name: "Rohan Bhattacharya",
    bio: "<p>Rohan is a printmaker working in linocut and etching, trained at the Government College of Art &amp; Craft in Kolkata. His editions draw on the city's tram lines, ferry ghats, and old-book markets, and are kept deliberately small.</p><p>He keeps an active GalleryZone plan and shares his studio process on social media, and is currently working toward his first confirmed sale on the platform.</p>",
    profileImageUrl: "/early-program/avatar-5.png",
    verification: {
      tier1SocialMedia: true,
      tier2ActivePlan: true,
      tier3FirstSale: false,
    },
    socialLinks: [
      { platform: "instagram", url: "https://www.instagram.com/rohan.prints/" },
    ],
  },
  {
    id: "ananya-deshmukh",
    headline: "Textile artist · hand embroidery and natural dye",
    location: "Pune, Maharashtra",
    joinedAt: "2026-08-02T00:00:00.000Z",
    name: "Ananya Deshmukh",
    bio: "<p>Ananya is a textile artist working in hand embroidery and natural-dye techniques she learned from her grandmother in rural Maharashtra, reinterpreted through contemporary wall-hung forms.</p><p>She joined GalleryZone this month and is completing her profile verification alongside her very first listings.</p>",
    profileImageUrl: "/ecosystem/avatar.png",
    verification: {
      tier1SocialMedia: false,
      tier2ActivePlan: false,
      tier3FirstSale: false,
    },
    socialLinks: [],
  },
  {
    id: "ishaan-kapoor",
    headline: "Painter · acrylic and found pigment, urban density",
    location: "New Delhi, Delhi",
    joinedAt: "2026-02-11T00:00:00.000Z",
    name: "Ishaan Kapoor",
    bio: "<p>Ishaan is a self-taught painter working in acrylic and found pigment, exploring the density of Delhi's built environment through fractured, layered compositions.</p><p>He sold his first piece directly through the GalleryZone marketplace and has linked his YouTube channel, where he posts full studio sessions from blank canvas to finished work.</p>",
    profileImageUrl: "/early-program/avatar-3.png",
    verification: {
      tier1SocialMedia: true,
      tier2ActivePlan: false,
      tier3FirstSale: true,
    },
    socialLinks: [
      {
        platform: "youtube",
        url: "https://www.youtube.com/@ishaankapoorstudio",
      },
    ],
  },
  {
    id: "priya-subramaniam",
    headline: "Mixed media · repurposed metal wall sculpture",
    location: "Hyderabad, Telangana",
    joinedAt: "2025-12-08T00:00:00.000Z",
    name: "Priya Subramaniam",
    bio: "<p>Priya builds mixed-media wall sculptures from repurposed metal and pigment, working out of a studio collective in Hyderabad.</p><p>She keeps an active GalleryZone plan and has completed her first confirmed sale through a partner aggregator, and prefers to let the work speak for itself rather than maintain a public social presence.</p>",
    profileImageUrl: "/early-program/avatar-1.png",
    verification: {
      tier1SocialMedia: false,
      tier2ActivePlan: true,
      tier3FirstSale: true,
    },
    socialLinks: [],
  },
];
