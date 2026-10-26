enum BlogStatus { submitted, accepted, rejected }

BlogStatus _blogStatus(Object? value) => switch (value) {
  'accepted' => BlogStatus.accepted,
  'rejected' => BlogStatus.rejected,
  _ => BlogStatus.submitted,
};

/// An artist-authored editorial post. Only accepted posts are returned by the
/// public API; an artist's own feed can contain all three review states.
class Blog {
  const Blog({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.title,
    required this.slug,
    required this.excerpt,
    required this.body,
    required this.status,
    required this.submittedAt,
    this.coverImageUrl,
    this.decisionNote,
    this.decidedAt,
    this.publishedAt,
  });

  final String id;
  final String authorId;
  final String authorName;
  final String title;
  final String slug;
  final String excerpt;
  final String body;
  final String? coverImageUrl;
  final BlogStatus status;
  final String? decisionNote;
  final String submittedAt;
  final String? decidedAt;
  final String? publishedAt;

  factory Blog.fromJson(Map<String, dynamic> json) => Blog(
    id: json['id'] as String? ?? '',
    authorId: json['authorId'] as String? ?? '',
    authorName: json['authorName'] as String? ?? 'Artist',
    title: json['title'] as String? ?? '',
    slug: json['slug'] as String? ?? '',
    excerpt: json['excerpt'] as String? ?? '',
    body: json['body'] as String? ?? '',
    coverImageUrl: json['coverImageUrl'] as String?,
    status: _blogStatus(json['status']),
    decisionNote: json['decisionNote'] as String?,
    submittedAt: json['submittedAt'] as String? ?? '',
    decidedAt: json['decidedAt'] as String?,
    publishedAt: json['publishedAt'] as String?,
  );
}

/// A GalleryZone recommendation that is bought on Amazon. [url] is already
/// the affiliate URL supplied by the server; checkout never happens in-app.
class AffiliateProduct {
  const AffiliateProduct({
    required this.id,
    required this.url,
    required this.title,
    required this.category,
    required this.images,
    required this.active,
    required this.createdAt,
    required this.updatedAt,
    this.asin,
    this.brand,
  });

  final String id;
  final String url;
  final String? asin;
  final String title;
  final String? brand;
  final String category;
  final List<String> images;
  final bool active;
  final String createdAt;
  final String updatedAt;

  factory AffiliateProduct.fromJson(Map<String, dynamic> json) =>
      AffiliateProduct(
        id: json['id'] as String? ?? '',
        url: json['url'] as String? ?? '',
        asin: json['asin'] as String?,
        title: json['title'] as String? ?? '',
        brand: json['brand'] as String?,
        category: json['category'] as String? ?? '',
        images: [
          for (final image in json['images'] as List? ?? const [])
            if (image is String) image,
        ],
        active: json['active'] != false,
        createdAt: json['createdAt'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );
}
