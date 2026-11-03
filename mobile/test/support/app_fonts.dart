import 'package:flutter/services.dart';

/// Registers the fonts the app ships, so a widget test lays text out in them
/// instead of the test engine's wide square placeholder glyphs. The printed
/// papers (the certificate and the display card) are laid out to the width of
/// their real fonts, so a test that draws one needs these.
///
/// Call it inside `tester.runAsync`: loading a font is real asynchronous work.
Future<void> loadAppFonts() async {
  const families = {
    'Inter': [
      'Inter-Regular.ttf',
      'Inter-Italic.ttf',
      'Inter-Medium.ttf',
      'Inter-SemiBold.ttf',
      'Inter-Bold.ttf',
    ],
    'Playfair Display': [
      'PlayfairDisplay-Regular.ttf',
      'PlayfairDisplay-Italic.ttf',
      'PlayfairDisplay-Medium.ttf',
      'PlayfairDisplay-SemiBold.ttf',
      'PlayfairDisplay-SemiBoldItalic.ttf',
      'PlayfairDisplay-Bold.ttf',
    ],
    'Tinos': ['Tinos-Regular.ttf'],
  };
  for (final entry in families.entries) {
    final loader = FontLoader(entry.key);
    for (final file in entry.value) {
      loader.addFont(rootBundle.load('assets/fonts/$file'));
    }
    await loader.load();
  }
  // The icon font ships inside its package.
  final icons = FontLoader('packages/lucide_icons_flutter/Lucide')
    ..addFont(
      rootBundle.load('packages/lucide_icons_flutter/assets/lucide.ttf'),
    );
  await icons.load();
}
