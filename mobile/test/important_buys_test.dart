import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/data/models/content.dart';
import 'package:gallery_zone/features/content/important_buys.dart';

AffiliateProduct _p(
  String id,
  String title, {
  String category = 'Easels',
  String created = '2026-10-02T00:00:00.000Z',
}) => AffiliateProduct(
  id: id,
  url: 'https://link.amazon/$id',
  title: title,
  category: category,
  images: const [],
  active: true,
  createdAt: created,
  updatedAt: created,
);

// The client's six, in the titles Amazon gives them, listed in the wrong order on purpose.
const _tube =
    'SEJASCOLLECTIONS Pack of 2 Premium, 23 Inch Length, Cardboard Mailing Tube, Ideal for Shipping';
const _bubble =
    'Bubble Wrap Roll, Heavy Duty 40 GSM, Clear, Packaging Cushioning for Fragile Items (1, 1FTx10FT)';
const _paper =
    'White Paper Roll 24 Inch X 5 Meter (80GSM) for Painting & Drawing Papers';
const _nail =
    'JIALTO 10 Pcs Stainless Steel, PVC, ABS Nail Free Seamless Adhesive Non-Trace No Drilling Installation Hanging, Waterproof Screws Wall Hook (Transparent)';
const _hook = 'A. Y .S Metal Hooks for MDF Board, Pack of 24';
const _nfc =
    'Pack of 10 - Anti-Metal NFC Tags (NTAG213) — 25 mm Round NFC Stickers with Ferrite Backing';

List<AffiliateProduct> _shelf() => [
  _p('1', 'Brustro Tabletop Easel', created: '2026-10-01T00:00:00.000Z'),
  _p(
    '2',
    _tube,
    category: importantBuysCategory,
    created: '2026-10-02T00:00:00.000Z',
  ),
  _p(
    '3',
    _bubble,
    category: importantBuysCategory,
    created: '2026-10-03T00:00:00.000Z',
  ),
  _p(
    '4',
    _paper,
    category: importantBuysCategory,
    created: '2026-10-04T00:00:00.000Z',
  ),
  _p(
    '5',
    _nail,
    category: importantBuysCategory,
    created: '2026-10-05T00:00:00.000Z',
  ),
  _p(
    '6',
    _hook,
    category: importantBuysCategory,
    created: '2026-10-06T00:00:00.000Z',
  ),
  _p(
    '7',
    _nfc,
    category: importantBuysCategory,
    created: '2026-10-07T00:00:00.000Z',
  ),
  _p(
    '8',
    'Newest Brush Set',
    category: 'Brushes',
    created: '2026-11-01T00:00:00.000Z',
  ),
];

List<String> _ids(List<AffiliateProduct> list) => [for (final p in list) p.id];

void main() {
  group('the Important buys segment', () {
    test('lists the client\'s six in their order, whatever order they were added in', () {
      final shown = shelfProducts(_shelf());
      // NFC, hanger, sticky nail, paper roll, bubble wrap, packaging tube; then the rest, in shelf order.
      expect(_ids(shown), ['7', '6', '5', '4', '3', '2', '1', '8']);
    });

    test('a hook that is a sticky nail is not mistaken for the hanger', () {
      expect(importantRank(_p('x', _nail, category: importantBuysCategory)), 3);
      expect(importantRank(_p('x', _hook, category: importantBuysCategory)), 1);
    });

    test(
      'a product in the category that matches no slot goes after the six',
      () {
        final other = _p('9', 'Packing tape', category: importantBuysCategory);
        expect(
          importantRank(other),
          greaterThan(
            importantRank(_p('x', _tube, category: importantBuysCategory)),
          ),
        );
        expect(
          importantRank(_p('y', _tube)),
          greaterThan(importantRank(other)),
          reason: 'outside the category is last',
        );
      },
    );

    test('shows as a block only on the plain shelf, and never empty', () {
      final shown = shelfProducts(_shelf());
      expect(showsImportantSegment(shown), isTrue);
      expect(showsImportantSegment(shown, query: 'bubble'), isFalse);
      expect(showsImportantSegment(shown, pill: newestPill), isFalse);
      expect(showsImportantSegment(shelfProducts([_shelf().first])), isFalse);
    });
  });

  group('the note about local shops', () {
    test('every important buy but the NFC tag carries it', () {
      final important = _shelf().where(
        (p) => p.category == importantBuysCategory,
      );
      expect(
        [
          for (final p in important)
            if (buyableLocally(p)) p.id,
        ],
        ['2', '3', '4', '5', '6'],
      );
      expect(
        buyableLocally(_p('1', 'Brustro Tabletop Easel')),
        isFalse,
        reason: 'outside the category',
      );
      expect(localShopNote, 'You can purchase them locally to save time');
    });
  });

  group('pills and search', () {
    test('a category pill lists only that category', () {
      expect(_ids(shelfProducts(_shelf(), pill: 'Brushes')), ['8']);
      expect(_ids(shelfProducts(_shelf(), pill: importantBuysCategory)), [
        '7',
        '6',
        '5',
        '4',
        '3',
        '2',
      ]);
    });

    test('Newest lists everything, latest first', () {
      expect(_ids(shelfProducts(_shelf(), pill: newestPill)).first, '8');
      expect(shelfProducts(_shelf(), pill: newestPill), hasLength(8));
    });

    test('search needs every word in title, brand or category', () {
      expect(_ids(shelfProducts(_shelf(), query: 'bubble wrap')), ['3']);
      expect(_ids(shelfProducts(_shelf(), query: 'important buys')), [
        '7',
        '6',
        '5',
        '4',
        '3',
        '2',
      ]);
      expect(shelfProducts(_shelf(), query: 'zzz'), isEmpty);
    });
  });
}
