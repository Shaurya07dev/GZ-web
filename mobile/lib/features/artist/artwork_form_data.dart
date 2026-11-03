import '../../data/models/artwork.dart';
import 'painting_styles.dart';

/// What the artwork form offers, and the small pure rules around it. Port of
/// `features/dashboard/artwork-submit-data.ts` plus the helpers at the top of
/// `artwork-submit-form.tsx`, kept out of the screen so they can be tested
/// without building one.

/// One choice in a dropdown: the value the API stores and the label the artist
/// reads.
class FormOption {
  const FormOption(this.value, this.label);

  final String value;
  final String label;
}

// Sculpture dropped 31 Oct 2026 (owner): GalleryZone currently only lists
// 2-D pieces, so offering it misleads artists into submitting work the
// platform can't actually list. Matches web artwork-submit-data.ts.
const artworkCategories = [
  FormOption('painting', 'Painting'),
  FormOption('printmaking', 'Printmaking'),
  FormOption('mixed-media', 'Mixed Media'),
  FormOption('textile', 'Textile Art'),
  FormOption('ceramics', 'Ceramics'),
];

/// The same 28 state-wise Indian traditions offered by the artist survey.
/// Values are the complete labels because that is what the API stores and the
/// COA prints. "Other" asks for free text.
const artworkTypes = [
  FormOption('Andhra Pradesh: Kalamkari', 'Andhra Pradesh: Kalamkari'),
  FormOption('Arunachal Pradesh: Thangka', 'Arunachal Pradesh: Thangka'),
  FormOption(
    'Assam: Assamese Scroll Painting',
    'Assam: Assamese Scroll Painting',
  ),
  FormOption(
    'Bihar: Madhubani (Mithila) Painting',
    'Bihar: Madhubani (Mithila) Painting',
  ),
  FormOption('Chhattisgarh: Godna', 'Chhattisgarh: Godna'),
  FormOption('Goa: Folk & Christian Art', 'Goa: Folk & Christian Art'),
  FormOption('Gujarat: Pithora Painting', 'Gujarat: Pithora Painting'),
  FormOption(
    'Haryana: Sculptural & Chitra Art',
    'Haryana: Sculptural & Chitra Art',
  ),
  FormOption(
    'Himachal Pradesh: Kangra Painting',
    'Himachal Pradesh: Kangra Painting',
  ),
  FormOption(
    'Jharkhand: Sohrai & Khovar Painting',
    'Jharkhand: Sohrai & Khovar Painting',
  ),
  FormOption(
    'Karnataka: Chittara / Mysore Painting',
    'Karnataka: Chittara / Mysore Painting',
  ),
  FormOption('Kerala: Kalamezhuthu', 'Kerala: Kalamezhuthu'),
  FormOption('Madhya Pradesh: Gond Art', 'Madhya Pradesh: Gond Art'),
  FormOption('Maharashtra: Warli Art', 'Maharashtra: Warli Art'),
  FormOption(
    'Manipur: Manipuri Scroll & Tribal Art',
    'Manipur: Manipuri Scroll & Tribal Art',
  ),
  FormOption(
    'Meghalaya: Tribal Motif Painting',
    'Meghalaya: Tribal Motif Painting',
  ),
  FormOption(
    'Mizoram: Tribal Decorative Art',
    'Mizoram: Tribal Decorative Art',
  ),
  FormOption('Nagaland: Cloth Painting', 'Nagaland: Cloth Painting'),
  FormOption('Odisha: Pattachitra', 'Odisha: Pattachitra'),
  FormOption(
    'Punjab: Mud-Work & Chowk Poorana',
    'Punjab: Mud-Work & Chowk Poorana',
  ),
  FormOption('Rajasthan: Phad Painting', 'Rajasthan: Phad Painting'),
  FormOption('Sikkim: Thangka Art', 'Sikkim: Thangka Art'),
  FormOption('Tamil Nadu: Tanjore Painting', 'Tamil Nadu: Tanjore Painting'),
  FormOption(
    'Telangana: Cheriyal Scroll Painting',
    'Telangana: Cheriyal Scroll Painting',
  ),
  FormOption('Tripura: Tribal Wall Art', 'Tripura: Tribal Wall Art'),
  FormOption('Uttar Pradesh: Sanjhi Art', 'Uttar Pradesh: Sanjhi Art'),
  FormOption('Uttarakhand: Aipan Art', 'Uttarakhand: Aipan Art'),
  FormOption(
    'West Bengal: Kalighat Painting',
    'West Bengal: Kalighat Painting',
  ),
  FormOption('other', 'Other'),
];

/// The API stores the slug; the card and detail page humanize it back.
const artworkMediums = [
  FormOption('oil-on-canvas', 'Oil on Canvas'),
  FormOption('acrylic-on-canvas', 'Acrylic on Canvas'),
  FormOption('watercolor', 'Watercolor'),
  FormOption('charcoal', 'Charcoal'),
  FormOption('ink', 'Ink'),
  FormOption('bronze', 'Bronze'),
  FormOption('ceramic-mixed-media', 'Ceramic & Mixed Media'),
  FormOption('other', 'Other'),
];

/// The surface the work is made on. An aggregator needs to know what they are
/// hanging, not a taxonomy.
const artworkFormats = [
  FormOption('canvas', 'Canvas'),
  FormOption('paper', 'Paper'),
  FormOption('board', 'Board / panel'),
  FormOption('wood', 'Wood'),
  FormOption('metal', 'Metal'),
  FormOption('stone', 'Stone'),
  FormOption('textile', 'Textile'),
  FormOption('other', 'Other'),
];

const dimensionUnits = ['in', 'cm'];

class ListingChoice {
  const ListingChoice(this.type, this.label, this.description);

  final ListingType type;
  final String label;
  final String description;
}

const listingChoices = [
  ListingChoice(
    ListingType.marketplaceOnly,
    'Marketplace',
    "Sell online through GalleryZone's own marketplace.",
  ),
  ListingChoice(
    ListingType.aggregatorOnly,
    'Aggregator',
    'Send the physical piece to a verified aggregator to display and sell in person.',
  ),
  ListingChoice(
    ListingType.marketplaceAndAggregator,
    'Both',
    'List online and make the piece available for aggregator display at the same time.',
  ),
];

const maxArtworkImages = 8;

/// What the API takes for a photo; the repository enforces the same limits when
/// it uploads, this is so the artist hears about a bad file when they pick it.
const maxImageBytes = 15 * 1024 * 1024;

/// Why [name] can't be uploaded, or null when it can.
String? imageProblem(String name, int bytes) {
  final extension = name.contains('.')
      ? name.split('.').last.toLowerCase()
      : '';
  if (!const {'jpg', 'jpeg', 'png', 'webp'}.contains(extension)) {
    return '"$name" isn\'t a JPEG, PNG or WebP image.';
  }
  if (bytes > maxImageBytes) {
    return '"$name" is larger than 15 MB. Please resize it and try again.';
  }
  return null;
}

// --- Dimensions --------------------------------------------------------------

typedef Dimensions = ({
  String length,
  String width,
  String height,
  String unit,
});

/// The API derives the size band from `L x W [x H] unit`, and this form is the
/// only thing that ever writes it, so splitting it back round-trips an edit
/// losslessly. Anything of another shape is older data the form never made -
/// it comes back empty and the caller keeps the original string untouched.
Dimensions parseDimensions(String? raw) {
  const empty = (length: '', width: '', height: '', unit: 'in');
  final match = raw == null ? null : _dimensionsShape.firstMatch(raw.trim());
  if (match == null) return empty;
  return (
    length: match[1]!,
    width: match[2]!,
    height: match[3] ?? '',
    unit: match[4]!.toLowerCase(),
  );
}

final _dimensionsShape = RegExp(
  r'^([\d.]+)\s*x\s*([\d.]+)(?:\s*x\s*([\d.]+))?\s*(in|cm)$',
  caseSensitive: false,
);

/// `24 x 36 in` / `24 x 36 x 2 in`, or empty when there is no length and width.
String composeDimensions(Dimensions dimensions) {
  if (dimensions.length.isEmpty || dimensions.width.isEmpty) return '';
  final parts = [
    dimensions.length,
    dimensions.width,
    dimensions.height,
  ].where((part) => part.isNotEmpty).join(' x ');
  return '$parts ${dimensions.unit}';
}

/// A typed measurement, tidied the way a number input would hand it over:
/// `60`, not `60.0` or ` 60 `. Null when it is not a positive number.
String? tidyMeasurement(String raw) {
  final value = double.tryParse(raw.trim());
  if (value == null || value <= 0) return null;
  return value == value.roundToDouble()
      ? value.round().toString()
      : value.toString();
}

// --- Stored values back into the form ----------------------------------------

/// Older records can carry the display name ("Oil on Canvas") where the API
/// now stores the slug ("oil-on-canvas"). Finds the option [stored] means, or
/// returns it as it came so the form can keep it rather than rewrite it.
String normalizeOption(String stored, List<FormOption> options) {
  final lowered = stored.trim().toLowerCase();
  final slug = lowered
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
  for (final option in options) {
    if (option.value == stored) return option.value;
  }
  for (final option in options) {
    if (option.label.toLowerCase() == lowered || option.value == slug) {
      return option.value;
    }
  }
  return stored;
}

/// The "Type of artwork" picker's value and its free text, from what is stored
/// (a label such as "Limited Edition Print", or the artist's own words).
({String type, String other}) artworkTypeFields(String? stored) {
  if ((stored ?? '').isEmpty) return (type: '', other: '');
  for (final option in artworkTypes) {
    if (option.value != 'other' && option.label == stored) {
      return (type: option.value, other: '');
    }
  }
  return (type: 'other', other: stored!);
}

/// What goes to the API for the picker: the label, or the artist's own words
/// for "Other".
String? artworkTypeToStore(String type, String other) {
  if (type == 'other') return other.trim().isEmpty ? null : other.trim();
  for (final option in artworkTypes) {
    if (option.value == type) return option.label;
  }
  return null;
}

/// The painting-style picker's value (a style name, `Other` or empty) and its
/// free text, from what is stored.
({String style, String other}) paintingStyleFields(String? stored) {
  if ((stored ?? '').isEmpty) return (style: '', other: '');
  if (paintingStyles.any((style) => style.name == stored)) {
    return (style: stored!, other: '');
  }
  return (style: 'Other', other: stored!);
}

/// Only paintings carry a style.
String? paintingStyleToStore(String category, String style, String other) {
  if (category != 'painting') return null;
  if (style == 'Other') return other.trim().isEmpty ? null : other.trim();
  return style.isEmpty ? null : style;
}

// --- Price ladder ------------------------------------------------------------

typedef PriceLadder = ({double base, double customer, double gstIncluded});

/// Where every rupee between the artist's rate and the listed price goes: the
/// markup first, then GST on top. Quoted from the rules GalleryZone published,
/// so a rate change reaches the form with no release.
PriceLadder priceLadderFor(
  double artistPrice, {
  required double markup,
  required double gstRate,
}) {
  final base = (artistPrice * (1 + markup)).roundToDouble();
  final customer = (base * (1 + gstRate)).roundToDouble();
  return (base: base, customer: customer, gstIncluded: customer - base);
}

/// `5` for 0.05, `12.5` for 0.125.
String percentLabel(double rate) {
  final percent = double.parse((rate * 100).toStringAsFixed(2));
  return percent == percent.roundToDouble()
      ? percent.round().toString()
      : percent.toString();
}

// --- Aggregator readiness ----------------------------------------------------

/// What is still missing before this can go for review on the aggregator
/// channel: the physical facts (MOU §12) and the artist's acceptance of the
/// display terms. Empty means ready.
List<String> missingForAggregatorListing(
  ArtworkPhysical physical, {
  required bool termsAccepted,
}) => [
  ...missingForAggregator(physical),
  if (!termsAccepted) 'aggregator terms accepted',
];
