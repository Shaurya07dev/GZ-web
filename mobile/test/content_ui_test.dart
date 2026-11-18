import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/theme/app_theme.dart';
import 'package:gallery_zone/data/models/content.dart';
import 'package:gallery_zone/data/repositories/content_repository.dart';
import 'package:gallery_zone/features/artist/screens/artist_blog_form_screen.dart';
import 'package:gallery_zone/features/content/providers/content_providers.dart';
import 'package:gallery_zone/features/content/screens/art_supplies_screen.dart';
import 'package:gallery_zone/features/content/screens/blogs_screen.dart';

class _Content implements ContentRepository {
  _Content({this.blogs = const [], this.products = const []});

  List<Blog> blogs;
  final List<AffiliateProduct> products;
  final submissions = <({String title, String excerpt, String body})>[];

  @override
  Future<List<Blog>> listPublishedBlogs() async =>
      blogs.where((blog) => blog.status == BlogStatus.accepted).toList();

  @override
  Future<Blog?> getPublishedBlog(String slug) async =>
      blogs.where((blog) => blog.slug == slug).firstOrNull;

  @override
  Future<List<AffiliateProduct>> listAffiliateProducts() async => products;

  @override
  Future<List<Blog>> listMyBlogs() async => blogs;

  @override
  Future<Blog> submitBlog({
    required String title,
    required String body,
    String excerpt = '',
  }) async {
    submissions.add((title: title, excerpt: excerpt, body: body));
    return _blog(title: title, status: BlogStatus.submitted);
  }

  @override
  Future<void> deleteBlog(String blogId) async =>
      blogs = blogs.where((blog) => blog.id != blogId).toList();
}

Blog _blog({
  String title = 'Painting the monsoon',
  BlogStatus status = BlogStatus.accepted,
}) => Blog(
  id: 'b1',
  authorId: 'artist-1',
  authorName: 'Ananya Rao',
  title: title,
  slug: 'painting-the-monsoon',
  excerpt: 'A note from the studio.',
  body: 'First paragraph.\n\nSecond paragraph.',
  status: status,
  submittedAt: '2026-10-01T00:00:00.000Z',
  publishedAt: status == BlogStatus.accepted
      ? '2026-10-02T00:00:00.000Z'
      : null,
);

AffiliateProduct _product(String id, String title, String category) =>
    AffiliateProduct(
      id: id,
      url: 'https://www.amazon.in/dp/B00000000$id?tag=galleryzone-21',
      title: title,
      category: category,
      images: const [],
      active: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    );

Future<void> _show(
  WidgetTester tester,
  Widget screen,
  _Content repository,
) async {
  tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      retry: (count, error) => null,
      overrides: [contentRepositoryProvider.overrideWithValue(repository)],
      child: MaterialApp(theme: AppTheme.light, home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('public blogs show only published editorial content', (
    tester,
  ) async {
    await _show(
      tester,
      const BlogsScreen(),
      _Content(
        blogs: [
          _blog(),
          _blog(title: 'Draft', status: BlogStatus.submitted),
        ],
      ),
    );
    expect(find.text('Painting the monsoon'), findsOneWidget);
    expect(find.textContaining('Ananya Rao'), findsOneWidget);
    expect(find.text('Draft'), findsNothing);
  });

  testWidgets(
    'the supply shelf searches and discloses the Amazon affiliate relationship',
    (tester) async {
      await _show(
        tester,
        const ArtSuppliesScreen(),
        _Content(
          products: [
            _product('1', 'Studio brush set', 'Brushes'),
            _product('2', 'Linen canvas', 'Canvas'),
          ],
        ),
      );
      expect(find.textContaining('Amazon Associate'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'canvas');
      await tester.pumpAndSettle();
      expect(find.text('Linen canvas'), findsOneWidget);
      expect(find.text('Studio brush set'), findsNothing);
    },
  );

  testWidgets(
    'Important buys leads the shelf in the client\'s order, and all but the NFC tag say they can be bought locally',
    (tester) async {
      // The client's six, added in the wrong order on purpose.
      const nfc = 'Anti-Metal NFC Tags (NTAG213) 25 mm Round Stickers';
      const hook = 'A. Y .S Metal Hooks for MDF Board, Pack of 24';
      const nail = 'JIALTO Nail Free Seamless Adhesive Wall Hook';
      const paper = 'White Paper Roll 24 Inch X 5 Meter';
      const bubble = 'Bubble Wrap Roll, Heavy Duty 40 GSM';
      const tube = 'Cardboard Mailing Tube, Pack of 2';
      const blockNote = 'What every artist needs to pack and send a piece out.';
      await _show(
        tester,
        const ArtSuppliesScreen(),
        _Content(
          products: [
            _product('1', 'Studio brush set', 'Brushes'),
            _product('2', tube, 'Important buys'),
            _product('3', bubble, 'Important buys'),
            _product('4', paper, 'Important buys'),
            _product('5', nail, 'Important buys'),
            _product('6', hook, 'Important buys'),
            _product('7', nfc, 'Important buys'),
          ],
        ),
      );

      expect(
        find.text(blockNote),
        findsOneWidget,
        reason: 'the block is on the shelf',
      );
      expect(find.text('All supplies'), findsOneWidget);

      // Row by row, left to right: NFC, hanger, sticky nail, paper roll, bubble wrap, packaging tube.
      final titles = [nfc, hook, nail, paper, bubble, tube];
      // A card's title sits a little higher or lower depending on its note, so a row
      // is "within 200 dp", not "the same y".
      final order = [...titles]
        ..sort((a, b) {
          final pa = tester.getTopLeft(find.text(a));
          final pb = tester.getTopLeft(find.text(b));
          final rowA = (pa.dy / 200).floor();
          final rowB = (pb.dy / 200).floor();
          return rowA != rowB ? rowA.compareTo(rowB) : pa.dx.compareTo(pb.dx);
        });
      expect(order, titles);
      expect(
        tester.getTopLeft(find.text('Studio brush set')).dy,
        greaterThan(tester.getTopLeft(find.text(tube)).dy),
        reason: 'the rest of the shelf comes after the block',
      );

      expect(
        find.text('You can purchase them locally to save time'),
        findsNWidgets(5),
        reason: 'every important buy but the NFC tag',
      );

      // A pill, like a search, lists products without the block.
      await tester.ensureVisible(find.text('Newest'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Newest'));
      await tester.pumpAndSettle();
      expect(find.text(blockNote), findsNothing);
      expect(find.text('All supplies'), findsNothing);
      expect(find.text(nfc), findsOneWidget);
    },
  );

  testWidgets(
    'artist blog form enforces the API minimums and submits trimmed text',
    (tester) async {
      final repository = _Content();
      await _show(tester, const ArtistBlogFormScreen(), repository);
      final button = find.widgetWithText(FilledButton, 'Submit for review');
      expect(tester.widget<FilledButton>(button).onPressed, isNull);

      await tester.enterText(
        find.widgetWithText(TextField, 'Title'),
        '  Inside my studio  ',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Excerpt (optional)'),
        '  A preview.  ',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Your post'),
        '  ${List.filled(8, 'A meaningful studio paragraph.').join(' ')}  ',
      );
      await tester.pump();
      await tester.tap(button);
      await tester.pumpAndSettle();

      expect(repository.submissions.single.title, 'Inside my studio');
      expect(repository.submissions.single.excerpt, 'A preview.');
      expect(
        repository.submissions.single.body.length,
        greaterThanOrEqualTo(100),
      );
      expect(find.textContaining('Submitted for review'), findsOneWidget);
    },
  );
}
