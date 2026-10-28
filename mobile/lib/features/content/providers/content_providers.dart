import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/mock/mock_content_repository.dart';
import '../../../data/models/content.dart';
import '../../../data/repositories/content_repository.dart';

final contentRepositoryProvider = Provider<ContentRepository>(
  (ref) => MockContentRepository(),
);

final publishedBlogsProvider = FutureProvider.autoDispose<List<Blog>>(
  (ref) => ref.watch(contentRepositoryProvider).listPublishedBlogs(),
);

final publishedBlogProvider = FutureProvider.autoDispose.family<Blog?, String>(
  (ref, slug) => ref.watch(contentRepositoryProvider).getPublishedBlog(slug),
);

final affiliateProductsProvider =
    FutureProvider.autoDispose<List<AffiliateProduct>>(
      (ref) => ref.watch(contentRepositoryProvider).listAffiliateProducts(),
    );

final artistBlogsProvider = FutureProvider.autoDispose<List<Blog>>(
  (ref) => ref.watch(contentRepositoryProvider).listMyBlogs(),
);
