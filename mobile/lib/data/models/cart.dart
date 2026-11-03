/// The signed-in user's cart, from `GET /v1/me/cart`. Each entry is the
/// bare minimum (artwork id + when it was added) so the artwork detail is
/// read fresh at render time — a sold or delisted piece naturally falls out.
class CartEntry {
  const CartEntry({required this.artworkId, required this.addedAt});

  final String artworkId;

  /// ISO-8601 UTC string. Drives the abandoned-cart sweep.
  final String addedAt;

  factory CartEntry.fromJson(Map<String, dynamic> json) => CartEntry(
    artworkId: json['artworkId'] as String? ?? '',
    addedAt: json['addedAt'] as String? ?? '',
  );
}

class Cart {
  const Cart({this.entries = const []});

  final List<CartEntry> entries;

  bool get isEmpty => entries.isEmpty;
  bool get isNotEmpty => entries.isNotEmpty;
  int get count => entries.length;

  bool contains(String artworkId) =>
      entries.any((e) => e.artworkId == artworkId);

  factory Cart.fromJson(Map<String, dynamic> json) => Cart(
    entries: (json['entries'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(CartEntry.fromJson)
        .toList(),
  );
}

/// 20 is big enough for a collector's working set and small enough that a
/// tampered client can't balloon the doc. Matches server + web.
const cartMaxItems = 20;
