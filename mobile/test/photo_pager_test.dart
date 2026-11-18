import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/data/models/artwork.dart';
import 'package:gallery_zone/features/marketplace/widgets/photo_pager.dart';

import 'support/catalog_fixtures.dart';

Widget _host(Widget child) => MaterialApp(
  home: Scaffold(body: SizedBox(width: 240, height: 300, child: child)),
);

Finder _photo(int n, int of) => find.bySemanticsLabel('Photo $n of $of');

void main() {
  group('photoUrlsOf', () {
    test('lists every photo cover first, in the artist\'s order', () {
      final artwork = fixtureArtwork().copyWith(
        thumbnailUrl: '/cover-thumb.jpg',
        images: const [
          ArtworkImage(
            url: '/two.jpg',
            thumbnailUrl: '/two-thumb.jpg',
            sortOrder: 1,
            altText: '',
          ),
          ArtworkImage(
            url: '/one.jpg',
            thumbnailUrl: '/one-thumb.jpg',
            sortOrder: 0,
            altText: '',
          ),
          ArtworkImage(
            url: '/three.jpg',
            thumbnailUrl: '',
            sortOrder: 2,
            altText: '',
          ),
        ],
      );
      expect(photoUrlsOf(artwork), [
        '/one-thumb.jpg',
        '/two-thumb.jpg',
        '/three.jpg',
      ]);
    });

    test('a piece with no photo list yet shows its cover alone', () {
      final artwork = fixtureArtwork().copyWith(
        thumbnailUrl: '/cover.jpg',
        images: const [],
      );
      expect(photoUrlsOf(artwork), ['/cover.jpg']);
    });
  });

  group('PhotoPager', () {
    testWidgets('a sideways drag moves to the next photo, and back', (
      tester,
    ) async {
      var shown = -1;
      await tester.pumpWidget(
        _host(
          PhotoPager(
            urls: const ['/a.jpg', '/b.jpg', '/c.jpg'],
            onPageChanged: (i) => shown = i,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(_photo(1, 3), findsOneWidget);

      await tester.drag(find.byType(PageView), const Offset(-240, 0));
      await tester.pumpAndSettle();
      expect(shown, 1);

      await tester.drag(find.byType(PageView), const Offset(-240, 0));
      await tester.pumpAndSettle();
      expect(shown, 2);

      await tester.drag(find.byType(PageView), const Offset(240, 0));
      await tester.pumpAndSettle();
      expect(shown, 1);
    });

    testWidgets(
      'a controller can move it, as the thumbnails on the artwork page do',
      (tester) async {
        final controller = PageController();
        addTearDown(controller.dispose);
        var shown = 0;
        await tester.pumpWidget(
          _host(
            PhotoPager(
              urls: const ['/a.jpg', '/b.jpg', '/c.jpg'],
              controller: controller,
              onPageChanged: (i) => shown = i,
            ),
          ),
        );
        controller.jumpToPage(2);
        await tester.pumpAndSettle();
        expect(shown, 2);
      },
    );

    testWidgets('a tap goes through to the card around it', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        _host(
          GestureDetector(
            onTap: () => taps++,
            child: const PhotoPager(urls: ['/a.jpg', '/b.jpg']),
          ),
        ),
      );
      await tester.tap(find.byType(PhotoPager));
      expect(taps, 1);
    });

    testWidgets('one photo, or a rail that must scroll, is just the photo', (
      tester,
    ) async {
      await tester.pumpWidget(_host(const PhotoPager(urls: ['/a.jpg'])));
      expect(find.byType(PageView), findsNothing);

      await tester.pumpWidget(
        _host(const PhotoPager(urls: ['/a.jpg', '/b.jpg'], swipeable: false)),
      );
      expect(
        find.byType(PageView),
        findsNothing,
        reason: 'the drag belongs to the rail',
      );
    });
  });
}
