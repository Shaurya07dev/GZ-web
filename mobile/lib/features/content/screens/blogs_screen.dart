import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/artwork_card.dart' show EmptyState;
import '../providers/content_providers.dart';

class BlogsScreen extends ConsumerWidget {
  const BlogsScreen({super.key});

  static const path = '/blogs';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blogs = ref.watch(publishedBlogsProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('GalleryZone blogs')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(publishedBlogsProvider);
          await ref.read(publishedBlogsProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
          children: [
            ContentWidth(
              maxWidth: 760,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Stories from working artists',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Studio notes, techniques and reflections, reviewed by GalleryZone before publication.',
                    style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                  ),
                  const SizedBox(height: 24),
                  blogs.when(
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (error, stack) => EmptyState(
                      icon: LucideIcons.penTool,
                      title: "The blogs didn't load",
                      description: authErrorMessage(error),
                      action: OutlinedButton(
                        onPressed: () => ref.invalidate(publishedBlogsProvider),
                        child: const Text('Try again'),
                      ),
                    ),
                    data: (items) => items.isEmpty
                        ? const EmptyState(
                            icon: LucideIcons.penTool,
                            title: 'Opening shortly',
                            description: 'The first essays are with our editors. Check back soon.',
                          )
                        : Column(
                            children: [
                              for (final blog in items)
                                InkWell(
                                  onTap: () => context.push(
                                    '/blogs/${Uri.encodeComponent(blog.slug)}',
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 18,
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Text(
                                          blog.title,
                                          style: theme.textTheme.titleLarge,
                                        ),
                                        const SizedBox(height: 7),
                                        Text(
                                          blog.excerpt,
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(height: 1.5),
                                        ),
                                        const SizedBox(height: 9),
                                        Text(
                                          [
                                            blog.authorName,
                                            if (blog.publishedAt != null)
                                              formatLongDate(blog.publishedAt!),
                                          ].join(' · '),
                                          style: theme.textTheme.labelSmall
                                              ?.copyWith(
                                                color:
                                                    theme.colorScheme.tertiary,
                                              ),
                                        ),
                                        const Divider(height: 36),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
