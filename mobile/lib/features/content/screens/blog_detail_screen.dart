import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../../core/motion.dart';
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/artwork_card.dart' show EmptyState;
import '../providers/content_providers.dart';

class BlogDetailScreen extends ConsumerWidget {
  const BlogDetailScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blog = ref.watch(publishedBlogProvider(slug));
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Blog')),
      body: blog.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.triangleAlert,
          title: "This post didn't load",
          description: authErrorMessage(error),
          action: OutlinedButton(
            onPressed: () => ref.invalidate(publishedBlogProvider(slug)),
            child: const Text('Try again'),
          ),
        ),
        data: (post) => post == null
            ? const EmptyState(
                icon: LucideIcons.fileText,
                title: 'Blog not found',
                description:
                    'It may have been unpublished, or the link is wrong.',
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
                children: [
                  ContentWidth(
                    maxWidth: 760,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          post.title,
                          style: theme.textTheme.headlineMedium?.copyWith(
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          [
                            post.authorName,
                            if (post.publishedAt != null)
                              formatLongDate(post.publishedAt!),
                          ].join(' · '),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.tertiary,
                          ),
                        ),
                        const SizedBox(height: 28),
                        for (final paragraph in post.body.split(
                          RegExp(r'\n{2,}'),
                        ))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 18),
                            child: Text(
                              paragraph,
                              style: theme.textTheme.bodyLarge?.copyWith(
                                height: 1.75,
                              ),
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
