import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:gallery_zone/features/splash/art_quotes.dart';
import 'package:gallery_zone/features/splash/splash_screen.dart';

/// Every launch opens on a new quote: dealt from a shuffled deck, none comes
/// round again until all of them have been shown.
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

  test('a full deck shows every quote once, then starts a new one', () async {
    SharedPreferences.setMockInitialValues({});
    final dealt = [
      for (var i = 0; i < artQuotes.length; i++) await nextLaunchQuote(),
    ];
    expect(dealt.toSet(), hasLength(artQuotes.length));
    expect(artQuotes, contains(await nextLaunchQuote()));
  });

  test('a deck saved against a different list is reshuffled', () async {
    SharedPreferences.setMockInitialValues({
      'gz-launch-quote-deck': ['${artQuotes.length + 5}'],
    });
    expect(artQuotes, contains(await nextLaunchQuote()));
  });
}
