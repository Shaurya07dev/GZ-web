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
