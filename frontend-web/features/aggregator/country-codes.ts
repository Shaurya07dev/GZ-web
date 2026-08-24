// Dial codes for the coordinator's direct phone (features/aggregator/profile-form.tsx).
// India first and selected by default — GalleryZone aggregators are India-based
// gallery/retail partners; the rest cover the other countries support most
// commonly hears from.
export interface CountryCode {
  dial: string;
  iso: string;
  label: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { dial: "+91", iso: "IN", label: "India" },
  { dial: "+1", iso: "US", label: "United States" },
  { dial: "+44", iso: "GB", label: "United Kingdom" },
  { dial: "+971", iso: "AE", label: "UAE" },
  { dial: "+65", iso: "SG", label: "Singapore" },
  { dial: "+61", iso: "AU", label: "Australia" },
  { dial: "+974", iso: "QA", label: "Qatar" },
  { dial: "+966", iso: "SA", label: "Saudi Arabia" },
  { dial: "+49", iso: "DE", label: "Germany" },
  { dial: "+33", iso: "FR", label: "France" },
  { dial: "+81", iso: "JP", label: "Japan" },
];

export const DEFAULT_COUNTRY_DIAL = "+91";

/**
 * Splits a stored "+91 98450 33127" style phone string into a known dial
 * code and the rest. Falls back to the default dial code when the value
 * doesn't start with a recognised one (e.g. legacy fixtures with no code).
 */
export function splitPhone(value: string): { dial: string; number: string } {
  const trimmed = value.trim();
  const match = COUNTRY_CODES.find((c) => trimmed.startsWith(`${c.dial} `));
  if (match) {
    return { dial: match.dial, number: trimmed.slice(match.dial.length).trim() };
  }
  return { dial: DEFAULT_COUNTRY_DIAL, number: trimmed };
}

export function joinPhone(dial: string, number: string): string {
  return `${dial} ${number.trim()}`.trim();
}
