import type { SVGProps } from "react";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function InstagramGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5 L19 19" />
      <path d="M19 5 L5 19" />
    </svg>
  );
}

export function LinkedinGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.5" y1="10.5" x2="7.5" y2="16.5" />
      <circle cx="7.5" cy="7" r="0.6" fill="currentColor" stroke="none" />
      <path d="M11.5 16.5 V10.5 M11.5 13 c0 -1.6 1 -2.5 2.3 -2.5 c1.3 0 2.2 0.8 2.2 2.4 v3.6" />
    </svg>
  );
}

// This lucide-react version ships no brand/logo glyphs at all (confirmed:
// no youtube/tiktok/instagram/x icon files exist in node_modules), which is
// why Instagram/X/LinkedIn above are already hand-drawn rather than
// imported. Youtube and Tiktok follow, matching the same minimal
// currentColor line-art voice, for the four SocialProofLink platforms used
// on the Artwork Detail page (types/artwork.ts).
export function YoutubeGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="18" height="12" rx="4" />
      <path d="M10.3 9.4 L15 12 L10.3 14.6 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TiktokGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M13.5 3.5 v11.3 a3.3 3.3 0 1 1 -3.3 -3.3 c0.3 0 0.6 0.03 0.9 0.08" />
      <path d="M13.5 3.5 a4.6 4.6 0 0 0 4.6 4.6" />
    </svg>
  );
}
