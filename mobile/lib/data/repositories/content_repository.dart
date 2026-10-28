import '../models/content.dart';

/// Public editorial/affiliate content plus the artist-authored blog workflow.
/// Admin moderation remains web-only.
abstract class ContentRepository {
  Future<List<Blog>> listPublishedBlogs();
  Future<Blog?> getPublishedBlog(String slug);
  Future<List<AffiliateProduct>> listAffiliateProducts();

  Future<List<Blog>> listMyBlogs();
  Future<Blog> submitBlog({
    required String title,
    required String body,
    String excerpt = '',
  });
  Future<void> deleteBlog(String blogId);
}
