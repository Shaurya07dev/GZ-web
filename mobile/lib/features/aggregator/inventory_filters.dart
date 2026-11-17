import '../../data/models/artwork.dart';
import '../../data/repositories/aggregator_repository.dart';

/// Search, filters and sort for the aggregator's Browse screen. The screen
/// already loads every reservable piece, so all of it is done on that list with
/// no extra request. Port of the website's `lib/inventory-filters.ts`; pure, so
/// it is tested without building a screen.

enum InventorySort {
  newest('Newest'),
  priceAsc('Price: Low to High'),
  priceDesc('Price: High to Low');

  const InventorySort(this.label);
  final String label;
}

class PriceBand {
  const PriceBand({this.min, this.max});

  final double? min;
  final double? max;

  bool contains(double price) =>
      (min == null || price >= min!) && (max == null || price < max!);
}

/// The same rupee bands as the marketplace's Price filter, applied to the price
/// the aggregator sees on the card.
const inventoryPriceBands = <PriceBand>[
  PriceBand(max: 10000),
  PriceBand(min: 10000, max: 25000),
  PriceBand(min: 25000, max: 50000),
  PriceBand(min: 50000, max: 100000),
  PriceBand(min: 100000),
];

const _keep = Object();

class InventoryFilters {
  const InventoryFilters({
    this.category,
    this.mediums = const [],
    this.ranks = const [],
    this.size,
    this.price,
    this.verifiedOnly = false,
    this.exclusiveOnly = false,
    this.savedOnly = false,
  });

  /// The category chip. Null is "All".
  final String? category;
  final List<String> mediums;
  final List<ArtworkRarity> ranks;
  final ArtworkSizeBand? size;

  /// Index into [inventoryPriceBands].
  final int? price;
  final bool verifiedOnly;
  final bool exclusiveOnly;

  /// The "Saved" chip: only pieces the aggregator has hearted.
  final bool savedOnly;

  /// A copy with the given fields changed. Pass `null` to clear a nullable one.
  InventoryFilters copyWith({
    Object? category = _keep,
    List<String>? mediums,
    List<ArtworkRarity>? ranks,
    Object? size = _keep,
    Object? price = _keep,
    bool? verifiedOnly,
    bool? exclusiveOnly,
    bool? savedOnly,
  }) => InventoryFilters(
    category: identical(category, _keep) ? this.category : category as String?,
    mediums: mediums ?? this.mediums,
    ranks: ranks ?? this.ranks,
    size: identical(size, _keep) ? this.size : size as ArtworkSizeBand?,
    price: identical(price, _keep) ? this.price : price as int?,
    verifiedOnly: verifiedOnly ?? this.verifiedOnly,
    exclusiveOnly: exclusiveOnly ?? this.exclusiveOnly,
    savedOnly: savedOnly ?? this.savedOnly,
  );

  /// Everything in the Filters panel cleared; the category and Saved chips stay.
  InventoryFilters clearedPanel() =>
      InventoryFilters(category: category, savedOnly: savedOnly);
}

/// Slugs ("acrylic-on-canvas") and words ("Acrylic on Canvas") should find each
/// other.
String _plain(Object? text) =>
    '${text ?? ''}'.replaceAll(RegExp(r'[-_]+'), ' ').toLowerCase();

/// Every word typed has to appear somewhere in the piece's title, artist,
/// medium, category, place or year.
bool matchesQuery(ReservableArtwork item, String query) {
  final words = _plain(query).split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  if (words.isEmpty) return true;
  final a = item.artwork;
  final haystack = [
    a.title,
    a.artistName,
    a.medium,
    a.category,
    a.artistLocation,
    a.paintingStyle,
    a.yearCreated,
  ].map(_plain).join(' ');
  return words.every(haystack.contains);
}

bool _matchesFilters(
  ReservableArtwork item,
  InventoryFilters f,
  Set<String> saved,
) {
  final a = item.artwork;
  if (f.category != null && a.category != f.category) return false;
  if (f.mediums.isNotEmpty && !f.mediums.contains(a.medium)) return false;
  if (f.ranks.isNotEmpty &&
      (a.rarityType == null || !f.ranks.contains(a.rarityType))) {
    return false;
  }
  if (f.size != null && a.sizeBand != f.size) return false;
  if (f.price != null &&
      !inventoryPriceBands[f.price!].contains(item.offer.offerPrice)) {
    return false;
  }
  if (f.verifiedOnly && !a.verifiedArtist) return false;
  if (f.exclusiveOnly && !a.exclusive) return false;
  if (f.savedOnly && !saved.contains(a.id)) return false;
  return true;
}

/// "Newest" keeps the order the API sends, which is newest first.
List<ReservableArtwork> applyInventory(
  List<ReservableArtwork> items,
  String query,
  InventoryFilters filters,
  InventorySort sort, {
  Set<String> saved = const {},
}) {
  final kept = [
    for (final item in items)
      if (matchesQuery(item, query) && _matchesFilters(item, filters, saved))
        item,
  ];
  switch (sort) {
    case InventorySort.priceAsc:
      kept.sort((a, b) => a.offer.offerPrice.compareTo(b.offer.offerPrice));
    case InventorySort.priceDesc:
      kept.sort((a, b) => b.offer.offerPrice.compareTo(a.offer.offerPrice));
    case InventorySort.newest:
      break;
  }
  return kept;
}

/// The Filters button's badge: everything set in the panel. The category and
/// Saved chips show their own state.
int activeFilterCount(InventoryFilters f) =>
    f.mediums.length +
    f.ranks.length +
    (f.size != null ? 1 : 0) +
    (f.price != null ? 1 : 0) +
    (f.verifiedOnly ? 1 : 0) +
    (f.exclusiveOnly ? 1 : 0);

bool isFiltering(String query, InventoryFilters f) =>
    query.trim().isNotEmpty ||
    f.category != null ||
    f.savedOnly ||
    activeFilterCount(f) > 0;

/// What is actually on the shelf, so no option in the panel leads to an empty
/// page.
class InventoryFacets {
  const InventoryFacets({
    required this.categories,
    required this.mediums,
    required this.ranks,
    required this.sizes,
    required this.prices,
    required this.verified,
    required this.exclusive,
  });

  final List<String> categories;

  /// Medium and how many pieces, most common first.
  final List<(String, int)> mediums;
  final Map<ArtworkRarity, int> ranks;
  final Map<ArtworkSizeBand, int> sizes;

  /// How many pieces fall in each of [inventoryPriceBands].
  final List<int> prices;
  final int verified;
  final int exclusive;
}

InventoryFacets inventoryFacets(List<ReservableArtwork> items) {
  final categories = <String>{};
  final mediums = <String, int>{};
  final ranks = <ArtworkRarity, int>{};
  final sizes = <ArtworkSizeBand, int>{};
  final prices = List<int>.filled(inventoryPriceBands.length, 0);
  var verified = 0;
  var exclusive = 0;
  for (final item in items) {
    final a = item.artwork;
    if (a.category.isNotEmpty) categories.add(a.category);
    if (a.medium.isNotEmpty) mediums[a.medium] = (mediums[a.medium] ?? 0) + 1;
    final rank = a.rarityType;
    if (rank != null) ranks[rank] = (ranks[rank] ?? 0) + 1;
    final size = a.sizeBand;
    if (size != null) sizes[size] = (sizes[size] ?? 0) + 1;
    for (var i = 0; i < inventoryPriceBands.length; i++) {
      if (inventoryPriceBands[i].contains(item.offer.offerPrice)) prices[i]++;
    }
    if (a.verifiedArtist) verified++;
    if (a.exclusive) exclusive++;
  }
  final sortedMediums = [
    for (final e in mediums.entries) (e.key, e.value),
  ]..sort((x, y) => y.$2 != x.$2 ? y.$2.compareTo(x.$2) : x.$1.compareTo(y.$1));
  return InventoryFacets(
    categories: categories.toList()..sort(),
    mediums: sortedMediums,
    ranks: ranks,
    sizes: sizes,
    prices: prices,
    verified: verified,
    exclusive: exclusive,
  );
}
