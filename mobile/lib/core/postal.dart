/// Country-aware postal validation shared by the profile forms.
///
/// This mirrors `frontend-web/lib/postal.ts`. India remains the default, while
/// unknown ISO countries use the backend's permissive 3-12 character rule.
class PostalFormat {
  const PostalFormat({
    required this.code,
    required this.name,
    required this.pattern,
    required this.example,
    required this.label,
    required this.maxLength,
  });

  final String code;
  final String name;
  final RegExp pattern;
  final String example;
  final String label;
  final int maxLength;
}

final postalCountries = <PostalFormat>[
  PostalFormat(
    code: 'IN',
    name: 'India',
    pattern: RegExp(r'^[1-9][0-9]{5}$'),
    example: '560001',
    label: 'PIN code',
    maxLength: 6,
  ),
  PostalFormat(
    code: 'US',
    name: 'United States',
    pattern: RegExp(r'^\d{5}(-\d{4})?$'),
    example: '94103 or 94103-1234',
    label: 'ZIP code',
    maxLength: 10,
  ),
  PostalFormat(
    code: 'GB',
    name: 'United Kingdom',
    pattern: RegExp(
      r'^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$',
      caseSensitive: false,
    ),
    example: 'SW1A 1AA',
    label: 'Postcode',
    maxLength: 8,
  ),
  PostalFormat(
    code: 'CA',
    name: 'Canada',
    pattern: RegExp(r'^[A-Z]\d[A-Z]\s?\d[A-Z]\d$', caseSensitive: false),
    example: 'K1A 0B1',
    label: 'Postal code',
    maxLength: 7,
  ),
  PostalFormat(
    code: 'AU',
    name: 'Australia',
    pattern: RegExp(r'^\d{4}$'),
    example: '2000',
    label: 'Postcode',
    maxLength: 4,
  ),
  PostalFormat(
    code: 'DE',
    name: 'Germany',
    pattern: RegExp(r'^\d{5}$'),
    example: '10115',
    label: 'PLZ',
    maxLength: 5,
  ),
  PostalFormat(
    code: 'FR',
    name: 'France',
    pattern: RegExp(r'^\d{5}$'),
    example: '75001',
    label: 'Code postal',
    maxLength: 5,
  ),
  PostalFormat(
    code: 'SG',
    name: 'Singapore',
    pattern: RegExp(r'^\d{6}$'),
    example: '238874',
    label: 'Postal code',
    maxLength: 6,
  ),
  PostalFormat(
    code: 'AE',
    name: 'United Arab Emirates',
    pattern: RegExp(r'^.{0,30}$'),
    example: 'PO Box 12345',
    label: 'PO Box',
    maxLength: 30,
  ),
  PostalFormat(
    code: 'JP',
    name: 'Japan',
    pattern: RegExp(r'^\d{3}-?\d{4}$'),
    example: '100-0001',
    label: 'Postal code',
    maxLength: 8,
  ),
  PostalFormat(
    code: 'CN',
    name: 'China',
    pattern: RegExp(r'^\d{6}$'),
    example: '100000',
    label: 'Postal code',
    maxLength: 6,
  ),
];

final unknownPostalFormat = PostalFormat(
  code: 'ZZ',
  name: 'Other',
  pattern: RegExp(
    r'^[A-Z0-9][A-Z0-9\s\-]{1,10}[A-Z0-9]$',
    caseSensitive: false,
  ),
  example: 'Postal code',
  label: 'Postal code',
  maxLength: 12,
);

const defaultCountryCode = 'IN';

PostalFormat postalFormatFor(String? countryCode) {
  final code = (countryCode ?? defaultCountryCode).toUpperCase();
  return postalCountries.where((country) => country.code == code).firstOrNull ??
      unknownPostalFormat;
}

bool isPostalValid(String? countryCode, String value) {
  final trimmed = value.trim();
  return trimmed.isNotEmpty &&
      postalFormatFor(countryCode).pattern.hasMatch(trimmed);
}
