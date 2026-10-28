import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/data/remote/remote_content_repository.dart';

import 'support/fake_api.dart';

void main() {
  test('public content maps blogs and the active Amazon shelf from their real endpoints', () async {
    final api = FakeApi()
      ..json('GET /v1/blogs', {
        'blogs': [
          {
            'id': 'b1',
            'authorId': 'artist-1',
            'authorName': 'Ananya Rao',
            'title': 'Painting the monsoon',
            'slug': 'painting-the-monsoon',
            'excerpt': 'A studio note.',
            'body': 'A long studio note.',
            'coverImageUrl': null,
            'status': 'accepted',
            'decisionNote': null,
            'submittedAt': '2026-10-01T00:00:00.000Z',
            'decidedAt': '2026-10-02T00:00:00.000Z',
            'publishedAt': '2026-10-02T00:00:00.000Z',
          },
        ],
      })
      ..json('GET /v1/affiliate-products', {
        'products': [
          {
            'id': 'p1',
            'url': 'https://www.amazon.in/dp/B000000001?tag=galleryzone-21',
            'asin': 'B000000001',
            'title': 'Studio brush set',
            'brand': 'Brush Co',
            'category': 'Brushes',
            'images': ['https://images.example/brush.jpg'],
            'active': true,
            'createdAt': '2026-10-01T00:00:00.000Z',
            'updatedAt': '2026-10-01T00:00:00.000Z',
          },
        ],
      });
    final repository = RemoteContentRepository(api.client());

    final blogs = await repository.listPublishedBlogs();
    final products = await repository.listAffiliateProducts();

    expect(blogs.single.slug, 'painting-the-monsoon');
    expect(blogs.single.publishedAt, '2026-10-02T00:00:00.000Z');
    expect(products.single.asin, 'B000000001');
    expect(products.single.images.single, 'https://images.example/brush.jpg');
  });

  test(
    'artist blog submit and delete use the exact guarded contracts',
    () async {
      final returned = {
        'id': 'b2',
        'authorId': 'artist-1',
        'authorName': 'Ananya Rao',
        'title': 'Inside my studio',
        'slug': 'inside-my-studio',
        'excerpt': 'A short introduction.',
        'body': List.filled(15, 'A thoughtful paragraph.').join(' '),
        'coverImageUrl': null,
        'status': 'submitted',
        'decisionNote': null,
        'submittedAt': '2026-10-25T00:00:00.000Z',
        'decidedAt': null,
        'publishedAt': null,
      };
      final api = FakeApi()
        ..json('POST /v1/artist/blogs', returned, status: 201)
        ..json('DELETE /v1/artist/blogs/b2', {'id': 'b2', 'deleted': true});
      final repository = RemoteContentRepository(api.client());

      final blog = await repository.submitBlog(
        title: '  Inside my studio  ',
        excerpt: '  A short introduction.  ',
        body: '  ${returned['body']}  ',
      );
      await repository.deleteBlog(blog.id);

      expect(api.bodiesOf('POST /v1/artist/blogs').single, {
        'title': 'Inside my studio',
        'excerpt': 'A short introduction.',
        'body': returned['body'],
      });
      expect(api.calls.last, 'DELETE /v1/artist/blogs/b2');
    },
  );
}
