import '../models/content.dart';
import '../repositories/content_repository.dart';
import 'mock_utils.dart';

class MockContentRepository implements ContentRepository {
  final _blogs = <Blog>[
    const Blog(
      id: 'blog-1',
      authorId: 'artist-1',
      authorName: 'Ananya Rao',
      title: 'What the monsoon taught my palette',
      slug: 'what-the-monsoon-taught-my-palette',
      excerpt: 'A studio note on indigo, wet earth, and letting weather into the work.',
      body: 'The first rain changes the colour of everything outside my studio. Pigments that felt too cool in summer suddenly belong to the room.\n\nI began this series by watching wet stone rather than sketching it. The paintings became less literal and more about the delay between a cloud arriving and the ground answering.',
      status: BlogStatus.accepted,
      submittedAt: '2026-09-28T00:00:00.000Z',
      decidedAt: '2026-09-29T00:00:00.000Z',
      publishedAt: '2026-09-29T00:00:00.000Z',
    ),
  ];

  static const _products = <AffiliateProduct>[
    AffiliateProduct(
      id: 'supply-1',
      url: 'https://www.amazon.in/',
      title: 'Professional round brush set',
      brand: 'GalleryZone pick',
      category: 'Brushes',
      images: [],
      active: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    ),
  ];

  @override
  Future<List<Blog>> listPublishedBlogs() => mockDelay(
    () => _blogs.where((b) => b.status == BlogStatus.accepted).toList(),
  );

  @override
  Future<Blog?> getPublishedBlog(String slug) => mockDelay(
    () => _blogs
        .where((b) => b.slug == slug && b.status == BlogStatus.accepted)
        .firstOrNull,
  );

  @override
  Future<List<AffiliateProduct>> listAffiliateProducts() =>
      mockDelay(() => _products);

  @override
  Future<List<Blog>> listMyBlogs() =>
      mockDelay(() => List.unmodifiable(_blogs.reversed));

  @override
  Future<Blog> submitBlog({
    required String title,
    required String body,
    String excerpt = '',
  }) => mockDelay(() {
    final cleanTitle = title.trim();
    final cleanBody = body.trim();
    if (cleanTitle.length < 4 || cleanBody.length < 100) {
      throw Exception('Add a title and at least 100 characters.');
    }
    final post = Blog(
      id: 'blog-${DateTime.now().microsecondsSinceEpoch}',
      authorId: 'artist-1',
      authorName: 'Ananya Rao',
      title: cleanTitle,
      slug: cleanTitle
          .toLowerCase()
          .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
          .replaceAll(RegExp(r'^-|-$'), ''),
      excerpt: excerpt.trim().isEmpty
          ? cleanBody.substring(0, cleanBody.length.clamp(0, 180))
          : excerpt.trim(),
      body: cleanBody,
      status: BlogStatus.submitted,
      submittedAt: DateTime.now().toUtc().toIso8601String(),
    );
    _blogs.add(post);
    return post;
  });

  @override
  Future<void> deleteBlog(String blogId) => mockDelay(() {
    final index = _blogs.indexWhere(
      (blog) => blog.id == blogId && blog.status == BlogStatus.submitted,
    );
    if (index < 0) throw Exception("A reviewed post can't be deleted.");
    _blogs.removeAt(index);
  });
}
