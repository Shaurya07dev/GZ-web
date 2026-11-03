import 'package:flutter_test/flutter_test.dart';

import 'package:gallery_zone/features/splash/art_quotes.dart';

/// The art quotes are no longer shown at launch (the opening is the mark alone),
/// but the collection is kept, so it stays clean.
void main() {
  test('the quotes are clean: a named author, no padding left in', () {
    for (final quote in artQuotes) {
      expect(quote.author.trim(), isNotEmpty);
      expect(quote.text, isNot(contains('[')));
      expect(quote.text, isNot(contains('creative vision')));
      expect('${quote.text}${quote.author}', isNot(contains('�')));
    }
    expect(artQuotes.map((q) => q.text).toSet(), hasLength(artQuotes.length));
  });
}
