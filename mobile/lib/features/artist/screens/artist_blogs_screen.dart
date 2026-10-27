import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../../data/models/content.dart';
import '../../auth/providers/auth_providers.dart';
import '../../content/providers/content_providers.dart';
import '../../marketplace/widgets/artwork_card.dart' show EmptyState;
import '../../shell/portal_widgets.dart';
import 'artist_blog_form_screen.dart';

class ArtistBlogsScreen extends ConsumerWidget {
  const ArtistBlogsScreen({super.key});

  static const path = '/dashboard/blogs';

  Future<void> _delete(BuildContext context, WidgetRef ref, Blog blog) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this draft?'),
        content: Text(
          '“${blog.title}” is still in review. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Delete draft'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(contentRepositoryProvider).deleteBlog(blog.id);
      ref.invalidate(artistBlogsProvider);
      messenger.showSnackBar(const SnackBar(content: Text('Draft deleted')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(authErrorMessage(error))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blogs = ref.watch(artistBlogsProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your blogs'),
        actions: [
          IconButton(
            onPressed: () => context.push(ArtistBlogFormScreen.path),
            tooltip: 'Write a new post',
            icon: const Icon(LucideIcons.plus),
          ),
        ],
      ),
      body: RefreshIndicator.adaptive(
        onRefresh: () async {
          ref.invalidate(artistBlogsProvider);
          await ref.read(artistBlogsProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            ContentWidth(
              maxWidth: 760,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Write about your practice. GalleryZone editors review every submission before it appears publicly.',
                    style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: () => context.push(ArtistBlogFormScreen.path),
                    icon: const Icon(LucideIcons.penTool, size: 15),
                    label: const Text('Write a new post'),
                  ),
                  const SizedBox(height: 18),
                  blogs.when(
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (error, stack) => EmptyState(
                      icon: LucideIcons.triangleAlert,
                      title: "Your blogs didn't load",
                      description: authErrorMessage(error),
                      action: OutlinedButton(
                        onPressed: () => ref.invalidate(artistBlogsProvider),
                        child: const Text('Try again'),
                      ),
                    ),
                    data: (items) => items.isEmpty
                        ? const EmptyState(
                            icon: LucideIcons.penTool,
                            title: 'Nothing yet',
                            description: 'Share a studio story, technique note, or what is on your easel.',
                          )
                        : Column(
                            children: [
                              for (final blog in items)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: PortalCard(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                blog.title,
                                                style:
                                                    theme.textTheme.titleMedium,
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            _BlogStatusPill(
                                              status: blog.status,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 7),
                                        Text(
                                          blog.excerpt.isEmpty
                                              ? blog.body
                                              : blog.excerpt,
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                          style: theme.textTheme.bodySmall
                                              ?.copyWith(height: 1.45),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          'Submitted ${formatShortDate(blog.submittedAt)}'
                                          '${blog.publishedAt == null ? '' : ' · published ${formatShortDate(blog.publishedAt!)}'}',
                                          style: theme.textTheme.labelSmall,
                                        ),
                                        if (blog.status ==
                                                BlogStatus.rejected &&
                                            (blog.decisionNote ?? '')
                                                .isNotEmpty) ...[
                                          const SizedBox(height: 9),
                                          PortalNotice(
                                            icon: LucideIcons.triangleAlert,
                                            destructive: true,
                                            title: "Editor's note",
                                            body: blog.decisionNote!,
                                          ),
                                        ],
                                        if (blog.status ==
                                            BlogStatus.submitted) ...[
                                          const SizedBox(height: 8),
                                          Align(
                                            alignment: Alignment.centerRight,
                                            child: TextButton.icon(
                                              onPressed: () =>
                                                  _delete(context, ref, blog),
                                              icon: const Icon(
                                                LucideIcons.trash2,
                                                size: 14,
                                              ),
                                              label: const Text('Delete draft'),
                                            ),
                                          ),
                                        ],
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

class _BlogStatusPill extends StatelessWidget {
  const _BlogStatusPill({required this.status});

  final BlogStatus status;

  @override
  Widget build(BuildContext context) => switch (status) {
    BlogStatus.submitted => StatusPill(
      label: 'In review',
      color: Theme.of(context).colorScheme.tertiary,
      icon: LucideIcons.clock3,
    ),
    BlogStatus.accepted => const StatusPill(
      label: 'Published',
      color: Color(0xFF34D399),
      icon: LucideIcons.check,
    ),
    BlogStatus.rejected => StatusPill(
      label: 'Not accepted',
      color: Theme.of(context).colorScheme.error,
      icon: LucideIcons.x,
    ),
  };
}
