import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/pricing.dart';
import 'package:gallery_zone/data/models/artwork.dart';
import 'package:gallery_zone/data/repositories/aggregator_repository.dart';
import 'package:gallery_zone/features/aggregator/inventory_filters.dart';

import 'support/catalog_fixtures.dart';

AggregatorOffer _offer(String id, double price) => AggregatorOffer(
  artworkId: id,
  month: 1,
  offerPrice: price,
  marketplacePrice: price,
  advance: 0,
  advanceRate: 0.05,
  advanceBase: price,
  advanceBasis: AdvanceBasis.sellingPrice,
  canSetPrice: true,
  daysLeftInListing: 150,
  deliveryCharge: 0,
  payable: 0,
);

ReservableArtwork _piece(
  String id, {
  required double price,
  String title = 'Untitled',
  String artist = 'Asha Rao',
  String category = 'painting',
  String medium = 'oil-on-canvas',
  ArtworkRarity? rank = ArtworkRarity.rare,
  ArtworkSizeBand? size = ArtworkSizeBand.medium,
  bool verified = true,
  bool exclusive = false,
  String? place,
}) => ReservableArtwork(
  artwork:
      fixtureArtwork(
        id: id,
        title: title,
        category: category,
        medium: medium,
        rank: rank,
        exclusive: exclusive,
      ).copyWith(
        artistName: artist,
        sizeBand: size,
        verifiedArtist: verified,
        artistLocation: place,
      ),
  offer: _offer(id, price),
);

final _shelf = [
  _piece('a', price: 8000, title: 'Monsoon Light', medium: 'oil-on-canvas'),
  _piece(
    'b',
    price: 30000,
    title: 'Tiger Panel',
    artist: 'Devika Menon',
    category: 'printmaking',
    medium: 'woodcut',
    rank: ArtworkRarity.unique,
    size: ArtworkSizeBand.small,
    verified: false,
    place: 'Pune, Maharashtra',
  ),
  _piece(
    'c',
    price: 150000,
    title: 'Blue Hour',
    medium: 'acrylic-on-canvas',
    rank: ArtworkRarity.original,
    size: ArtworkSizeBand.large,
    exclusive: true,
  ),
];

List<String> _ids(List<ReservableArtwork> list) => [
  for (final item in list) item.artwork.id,
];

List<ReservableArtwork> _run(
  String query,
  InventoryFilters filters, {
  InventorySort sort = InventorySort.newest,
  Set<String> saved = const {},
}) => applyInventory(_shelf, query, filters, sort, saved: saved);

void main() {
  const none = InventoryFilters();

  group('search', () {
    test('finds a piece by title, artist, medium, place or year', () {
      expect(_ids(_run('monsoon', none)), ['a']);
      expect(_ids(_run('devika', none)), ['b']);
      expect(_ids(_run('woodcut', none)), ['b']);
      expect(_ids(_run('pune', none)), ['b']);
      expect(_ids(_run('2021', none)), [
        'a',
        'b',
        'c',
      ], reason: 'the fixture year');
    });

    test('words and slugs find each other, and every word has to match', () {
      expect(_ids(_run('acrylic on canvas', none)), ['c']);
      expect(_ids(_run('oil-on-canvas', none)), ['a']);
      expect(_ids(_run('asha blue', none)), ['c']);
      expect(_ids(_run('asha tiger', none)), isEmpty);
      expect(_ids(_run('   ', none)), ['a', 'b', 'c']);
    });
  });

  group('filters', () {
    test('category, medium, rank, size, verified and exclusive each narrow the list', () {
      expect(_ids(_run('', none.copyWith(category: 'printmaking'))), ['b']);
      expect(
        _ids(_run('', none.copyWith(mediums: ['woodcut', 'oil-on-canvas']))),
        ['a', 'b'],
      );
      expect(_ids(_run('', none.copyWith(ranks: [ArtworkRarity.unique]))), [
        'b',
      ]);
      expect(_ids(_run('', none.copyWith(size: ArtworkSizeBand.large))), ['c']);
      expect(_ids(_run('', none.copyWith(verifiedOnly: true))), ['a', 'c']);
      expect(_ids(_run('', none.copyWith(exclusiveOnly: true))), ['c']);
    });

    test('a price band takes its lower edge and leaves its upper one', () {
      expect(_ids(_run('', none.copyWith(price: 0))), [
        'a',
      ], reason: 'under 10,000');
      expect(_ids(_run('', none.copyWith(price: 2))), [
        'b',
      ], reason: '25,000 to 50,000');
      expect(_ids(_run('', none.copyWith(price: 4))), [
        'c',
      ], reason: 'above 1,00,000');
      expect(inventoryPriceBands[0].contains(10000), isFalse);
      expect(inventoryPriceBands[1].contains(10000), isTrue);
    });

    test('Saved shows only the hearted pieces, and together with the rest', () {
      expect(
        _ids(_run('', none.copyWith(savedOnly: true), saved: {'b', 'c'})),
        ['b', 'c'],
      );
      expect(
        _ids(
          _run(
            '',
            none.copyWith(savedOnly: true, verifiedOnly: true),
            saved: {'b', 'c'},
          ),
        ),
        ['c'],
      );
      expect(_ids(_run('', none.copyWith(savedOnly: true))), isEmpty);
    });

    test('a null can be set back: clearing the size or the price', () {
      final set = none.copyWith(size: ArtworkSizeBand.small, price: 1);
      expect(set.size, ArtworkSizeBand.small);
      final cleared = set.copyWith(size: null, price: null);
      expect(cleared.size, isNull);
      expect(cleared.price, isNull);
      expect(
        set.copyWith(verifiedOnly: true).size,
        ArtworkSizeBand.small,
        reason: 'untouched fields stay',
      );
    });
  });

  group('sort', () {
    test('Newest keeps the order the API sent; the price sorts do not', () {
      expect(_ids(_run('', none)), ['a', 'b', 'c']);
      expect(_ids(_run('', none, sort: InventorySort.priceDesc)), [
        'c',
        'b',
        'a',
      ]);
      expect(_ids(_run('', none, sort: InventorySort.priceAsc)), [
        'a',
        'b',
        'c',
      ]);
      expect(_ids(_shelf), [
        'a',
        'b',
        'c',
      ], reason: 'the shelf itself is not reordered');
    });
  });

  group('the Filters badge and the shelf facets', () {
    test('the badge counts what is set in the panel, not the chips', () {
      expect(activeFilterCount(none), 0);
      expect(
        activeFilterCount(none.copyWith(category: 'painting', savedOnly: true)),
        0,
      );
      expect(
        activeFilterCount(
          none.copyWith(
            mediums: ['woodcut', 'oil-on-canvas'],
            ranks: [ArtworkRarity.rare],
            size: ArtworkSizeBand.small,
            price: 1,
            verifiedOnly: true,
            exclusiveOnly: true,
          ),
        ),
        7,
      );
      final cleared = none
          .copyWith(category: 'painting', savedOnly: true, verifiedOnly: true)
          .clearedPanel();
      expect(cleared.category, 'painting');
      expect(cleared.savedOnly, isTrue);
      expect(activeFilterCount(cleared), 0);
    });

    test('isFiltering is true for a query, a chip or a panel setting', () {
      expect(isFiltering('', none), isFalse);
      expect(isFiltering(' x ', none), isTrue);
      expect(isFiltering('', none.copyWith(category: 'painting')), isTrue);
      expect(isFiltering('', none.copyWith(savedOnly: true)), isTrue);
      expect(isFiltering('', none.copyWith(verifiedOnly: true)), isTrue);
    });

    test('facets count only what is on the shelf', () {
      final facets = inventoryFacets(_shelf);
      expect(facets.categories, ['painting', 'printmaking']);
      expect(facets.mediums.map((m) => m.$1), [
        'acrylic-on-canvas',
        'oil-on-canvas',
        'woodcut',
      ], reason: 'ties by name');
      expect(facets.ranks, {
        ArtworkRarity.rare: 1,
        ArtworkRarity.unique: 1,
        ArtworkRarity.original: 1,
      });
      expect(facets.sizes[ArtworkSizeBand.small], 1);
      expect(facets.prices, [1, 0, 1, 0, 1]);
      expect(facets.verified, 2);
      expect(facets.exclusive, 1);
    });
  });
}
