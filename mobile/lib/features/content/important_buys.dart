import '../../data/models/content.dart';

/// The things every artist needs to send a piece out, pinned to the top of the
/// art supplies shelf (client, 14 and 15 Nov 2026). An admin puts a product
/// there by giving it the category "Important buys". Port of the website's
/// `features/art-supplies/supplies-shelf.tsx` and `supply-card.tsx`.
const importantBuysCategory = 'Important buys';

/// The "Newest" pill is not a category: it lists everything, latest first.
const newestPill = '__newest';

const localShopNote = 'You can purchase them locally to save time';

/// One entry per slot, in the client's order; any word in an entry puts the
/// product in that slot. Nylon thread has no product yet.
const _order = <List<String>>[
  ['nfc', 'ntag'],
  ['hanger', 'metal hook'],
  ['nylon thread'],
  ['sticky nail', 'nail free'],
  ['rolling paper', 'paper roll'],
  ['bubble'],
  ['mailing tube', 'packaging tube'],
  ['cardboard', 'corrugated'],
];

/// Where a product sits in the segment; one with a title that matches no slot
/// goes after the rest, and a product outside the category is last of all.
int importantRank(AffiliateProduct product) {
  if (product.category != importantBuysCategory) return 1 << 30;
  final title = product.title.toLowerCase();
  final at = _order.indexWhere((words) => words.any(title.contains));
  return at == -1 ? _order.length : at;
}

/// Everything in Important buys except the NFC tag (which has to be the right
/// chip) can be bought in a local shop.
bool buyableLocally(AffiliateProduct product) =>
    product.category == importantBuysCategory &&
    !RegExp('nfc|ntag', caseSensitive: false).hasMatch(product.title);

/// What the shelf lists: [products] narrowed by the chosen pill and the search,
/// the important buys in the client's order (a stable sort, so everything else
/// keeps the shelf's own order), or latest first for the Newest pill.
List<AffiliateProduct> shelfProducts(
  List<AffiliateProduct> products, {
  String? pill,
  String query = '',
}) {
  final words = query
      .toLowerCase()
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty);
  bool matches(AffiliateProduct p) {
    final text = '${p.title} ${p.brand ?? ''} ${p.category}'.toLowerCase();
    return words.every(text.contains);
  }

  final kept = [
    for (final p in products)
      if ((pill == null || pill == newestPill || p.category == pill) &&
          matches(p))
        p,
  ];
  if (pill == newestPill) {
    return kept..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }
  // List.sort is not guaranteed stable, so rank-then-position is explicit.
  final position = {for (var i = 0; i < kept.length; i++) kept[i].id: i};
  kept.sort((a, b) {
    final byRank = importantRank(a).compareTo(importantRank(b));
    return byRank != 0 ? byRank : position[a.id]!.compareTo(position[b.id]!);
  });
  return kept;
}

/// Whether the shelf shows the Important buys block of its own: only on the
/// plain shelf (no pill, no search), and never as an empty block.
bool showsImportantSegment(
  List<AffiliateProduct> shown, {
  String? pill,
  String query = '',
}) =>
    pill == null &&
    query.trim().isEmpty &&
    shown.any((p) => p.category == importantBuysCategory);
