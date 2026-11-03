import 'package:flutter/foundation.dart';

import 'artwork.dart';
import 'marketplace.dart' show marketplacePageSize;

enum ArtworkSortBy { newest, priceAsc, priceDesc }

/// Everything the marketplace can be narrowed by — the same set the website's
/// sidebar offers, and what the API's `GET /v1/artworks` accepts.
///
/// Category and medium are multi-select (a piece matches if it is *any* of
/// the chosen values); everything else is a single value. [page] is 1-based.
class ArtworkFilters {
  const ArtworkFilters({
    this.categories = const [],
    this.mediums = const [],
    this.rarities = const [],
    this.artistId,
    this.location,
    this.size,
    this.minPrice,
    this.maxPrice,
    this.query,
    this.sortBy,
    this.page = 1,
    this.pageSize = marketplacePageSize,
  });

  final List<String> categories;
  final List<String> mediums;

  /// Multi-select rank filter — a piece matches if its rank is *any* of
  /// these. Owner directive 31 Oct 2026 (web parity).
  final List<ArtworkRarity> rarities;
  final String? artistId;

  /// The artist's location — an artwork has none of its own.
  final String? location;
  final ArtworkSizeBand? size;

  /// Rupees, GST-inclusive — what the card shows.
  final double? minPrice;
  final double? maxPrice;
  final String? query;
  final ArtworkSortBy? sortBy;
  final int page;

  /// How many pieces one page holds. The default is the listing's own size;
  /// the filter sheet asks once for the API's largest page to count options.
  final int pageSize;

  /// Whether anything beyond the default view is applied (sort and page do
  /// not count: they reorder and slice, they do not narrow).
  bool get isNarrowed => activeCount > 0;

  /// How many separate narrowing choices are active — the filter badge.
  int get activeCount =>
      categories.length +
      mediums.length +
      rarities.length +
      (artistId != null ? 1 : 0) +
      (location != null ? 1 : 0) +
      (size != null ? 1 : 0) +
      (minPrice != null || maxPrice != null ? 1 : 0);

  /// A nullable field is cleared by passing `null` and left alone by omitting
  /// it. Any change to what is being asked for starts again from page 1; only
  /// an explicit [page] moves along.
  ArtworkFilters copyWith({
    List<String>? categories,
    List<String>? mediums,
    List<ArtworkRarity>? rarities,
    Object? artistId = _unset,
    Object? location = _unset,
    Object? size = _unset,
    Object? minPrice = _unset,
    Object? maxPrice = _unset,
    Object? query = _unset,
    Object? sortBy = _unset,
    int? page,
    int? pageSize,
  }) {
    return ArtworkFilters(
      categories: categories ?? this.categories,
      mediums: mediums ?? this.mediums,
      rarities: rarities ?? this.rarities,
      artistId: artistId == _unset ? this.artistId : artistId as String?,
      location: location == _unset ? this.location : location as String?,
      size: size == _unset ? this.size : size as ArtworkSizeBand?,
      minPrice: minPrice == _unset ? this.minPrice : minPrice as double?,
      maxPrice: maxPrice == _unset ? this.maxPrice : maxPrice as double?,
      query: query == _unset ? this.query : query as String?,
      sortBy: sortBy == _unset ? this.sortBy : sortBy as ArtworkSortBy?,
      page: page ?? 1,
      pageSize: pageSize ?? this.pageSize,
    );
  }

  // Value equality matters here beyond tidiness: this type is a Riverpod
  // family argument, and without it every rebuild would key a *new* provider
  // instance and refetch.
  @override
  bool operator ==(Object other) =>
      other is ArtworkFilters &&
      listEquals(other.categories, categories) &&
      listEquals(other.mediums, mediums) &&
      listEquals(other.rarities, rarities) &&
      other.artistId == artistId &&
      other.location == location &&
      other.size == size &&
      other.minPrice == minPrice &&
      other.maxPrice == maxPrice &&
      other.query == query &&
      other.sortBy == sortBy &&
      other.page == page &&
      other.pageSize == pageSize;

  @override
  int get hashCode => Object.hash(
    Object.hashAll(categories),
    Object.hashAll(mediums),
    Object.hashAll(rarities),
    artistId,
    location,
    size,
    minPrice,
    maxPrice,
    query,
    sortBy,
    page,
    pageSize,
  );
}

/// Sentinel so [ArtworkFilters.copyWith] can tell "leave this alone" apart
/// from "clear this filter" — every nullable field here can be cleared, and
/// clearing one is the common case (`All ranks`, an emptied price box).
const _unset = Object();
