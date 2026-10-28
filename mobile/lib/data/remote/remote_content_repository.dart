import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/api/json_utils.dart';
import '../models/content.dart';
import '../repositories/content_repository.dart';

class RemoteContentRepository implements ContentRepository {
  const RemoteContentRepository(this.api);

  final ApiClient api;

  @override
  Future<List<Blog>> listPublishedBlogs() async {
    final json = await api.getMap('/v1/blogs', auth: false);
    return asMapList(json['blogs']).map(Blog.fromJson).toList();
  }

  @override
  Future<Blog?> getPublishedBlog(String slug) async {
    try {
      return Blog.fromJson(
        await api.getMap('/v1/blogs/${Uri.encodeComponent(slug)}', auth: false),
      );
    } on ApiError catch (error) {
      if (error.isNotFound) return null;
      rethrow;
    }
  }

  @override
  Future<List<AffiliateProduct>> listAffiliateProducts() async {
    final json = await api.getMap('/v1/affiliate-products', auth: false);
    return asMapList(json['products']).map(AffiliateProduct.fromJson).toList();
  }

  @override
  Future<List<Blog>> listMyBlogs() async {
    final json = await api.getMap('/v1/artist/blogs');
    return asMapList(json['blogs']).map(Blog.fromJson).toList();
  }

  @override
  Future<Blog> submitBlog({
    required String title,
    required String body,
    String excerpt = '',
  }) async {
    final cleanTitle = title.trim();
    final cleanBody = body.trim();
    final cleanExcerpt = excerpt.trim();
    if (cleanTitle.length < 4 || cleanTitle.length > 160) {
      throw Exception('Use a title between 4 and 160 characters.');
    }
    if (cleanBody.length < 100 || cleanBody.length > 20000) {
      throw Exception('Write between 100 and 20,000 characters.');
    }
    if (cleanExcerpt.length > 300) {
      throw Exception('Keep the excerpt under 300 characters.');
    }
    return Blog.fromJson(
      asMap(
        await api.post(
          '/v1/artist/blogs',
          body: {
            'title': cleanTitle,
            if (cleanExcerpt.isNotEmpty) 'excerpt': cleanExcerpt,
            'body': cleanBody,
          },
        ),
      ),
    );
  }

  @override
  Future<void> deleteBlog(String blogId) async {
    await api.delete('/v1/artist/blogs/${Uri.encodeComponent(blogId)}');
  }
}
