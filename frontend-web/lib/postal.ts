// Country-aware postal code validation + friendly hints.
//
// India is the common case (every current artist is Indian), so it leads the
// list and is the default when none is set. The rest cover the countries
// most likely to appear for international artists — the regex column is
// permissive enough to accept the normal spellings and tolerate casing and
// internal spaces/hyphens.
//
// When a country isn't listed, the field falls back to the UNKNOWN entry's
// loose pattern — alphanumeric 3–12 characters — so an artist from an
// unlisted country can still fill in the form; the backend uses the same
// permissive fallback.

export interface PostalFormat {
  /** ISO 3166-1 alpha-2 code, uppercase. */
  code: string;
  /** Human-readable country name. */
  name: string;
  /** Case-insensitive full-match pattern. */
  pattern: RegExp;
  /** What the input should look like (shown as placeholder + hint). */
  example: string;
  /** The field label — "PIN code" for India, "Postal code" elsewhere. */
  label: string;
  /** Max input length, used for maxLength on the <input>. */
  maxLength: number;
}

export const COUNTRIES: PostalFormat[] = [
  {
    code: "IN",
    name: "India",
    // Six digits, first non-zero — the same rule the backend has always had.
    pattern: /^[1-9][0-9]{5}$/,
    example: "560001",
    label: "PIN code",
    maxLength: 6,
  },
  {
    code: "US",
    name: "United States",
    // ZIP or ZIP+4.
    pattern: /^\d{5}(-\d{4})?$/,
    example: "94103 or 94103-1234",
    label: "ZIP code",
    maxLength: 10,
  },
  {
    code: "GB",
    name: "United Kingdom",
    // The full UK postcode spec is ugly; this covers every real-world shape
    // (SW1A 1AA, M1 1AE, EC1A 1BB, etc.) without pretending to be exhaustive.
    pattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    example: "SW1A 1AA",
    label: "Postcode",
    maxLength: 8,
  },
  {
    code: "CA",
    name: "Canada",
    pattern: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
    example: "K1A 0B1",
    label: "Postal code",
    maxLength: 7,
  },
  {
    code: "AU",
    name: "Australia",
    pattern: /^\d{4}$/,
    example: "2000",
    label: "Postcode",
    maxLength: 4,
  },
  {
    code: "DE",
    name: "Germany",
    pattern: /^\d{5}$/,
    example: "10115",
    label: "PLZ",
    maxLength: 5,
  },
  {
    code: "FR",
    name: "France",
    pattern: /^\d{5}$/,
    example: "75001",
    label: "Code postal",
    maxLength: 5,
  },
  {
    code: "SG",
    name: "Singapore",
    pattern: /^\d{6}$/,
    example: "238874",
    label: "Postal code",
    maxLength: 6,
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    // The UAE has no postal codes; a PO box is used instead.
    pattern: /^.{0,30}$/,
    example: "PO Box 12345",
    label: "PO Box",
    maxLength: 30,
  },
  {
    code: "JP",
    name: "Japan",
    pattern: /^\d{3}-?\d{4}$/,
    example: "100-0001",
    label: "Postal code",
    maxLength: 8,
  },
  {
    code: "CN",
    name: "China",
    pattern: /^\d{6}$/,
    example: "100000",
    label: "Postal code",
    maxLength: 6,
  },
];

// Catch-all for countries not in the list above — the artist can still fill
// in the form rather than being blocked, and the backend applies the same
// permissive rule.
export const UNKNOWN_POSTAL: PostalFormat = {
  code: "ZZ",
  name: "Other",
  pattern: /^[A-Z0-9][A-Z0-9\s\-]{1,10}[A-Z0-9]$/i,
  example: "Postal code",
  label: "Postal code",
  maxLength: 12,
};

export const DEFAULT_COUNTRY_CODE = "IN";

export function postalFormatFor(countryCode: string | null | undefined): PostalFormat {
  if (!countryCode) return COUNTRIES[0]!;
  const match = COUNTRIES.find((c) => c.code === countryCode.toUpperCase());
  return match ?? UNKNOWN_POSTAL;
}

export function isPostalValid(countryCode: string | null | undefined, value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return postalFormatFor(countryCode).pattern.test(trimmed);
}
