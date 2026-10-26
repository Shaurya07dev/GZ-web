import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../auth/providers/auth_providers.dart';
import '../../content/providers/content_providers.dart';
import '../../shell/portal_widgets.dart';

class ArtistBlogFormScreen extends ConsumerStatefulWidget {
  const ArtistBlogFormScreen({super.key});

  static const path = '/dashboard/blogs/new';

  @override
  ConsumerState<ArtistBlogFormScreen> createState() =>
      _ArtistBlogFormScreenState();
}

class _ArtistBlogFormScreenState extends ConsumerState<ArtistBlogFormScreen> {
  final _title = TextEditingController();
  final _excerpt = TextEditingController();
  final _body = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _title.dispose();
    _excerpt.dispose();
    _body.dispose();
    super.dispose();
  }

  bool get _valid =>
      !_submitting &&
      _title.text.trim().length >= 4 &&
      _title.text.trim().length <= 160 &&
      _excerpt.text.trim().length <= 300 &&
      _body.text.trim().length >= 100 &&
      _body.text.trim().length <= 20000;

  Future<void> _submit() async {
    if (!_valid) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _submitting = true);
    try {
      await ref
          .read(contentRepositoryProvider)
          .submitBlog(
            title: _title.text.trim(),
            excerpt: _excerpt.text.trim(),
            body: _body.text.trim(),
          );
      ref.invalidate(artistBlogsProvider);
      if (!mounted) return;
      _title.clear();
      _excerpt.clear();
      _body.clear();
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Submitted for review — GalleryZone editors will read it before publication.',
          ),
        ),
      );
    } catch (error) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(authErrorMessage(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bodyLength = _body.text.trim().length;
    return Scaffold(
      appBar: AppBar(title: const Text('Write a blog')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
        children: [
          ContentWidth(
            maxWidth: 760,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Share a studio story, technique note, or reflection. Paragraphs are preserved; editors can add links and formatting.',
                  style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                ),
                const SizedBox(height: 16),
                PortalCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _title,
                        onChanged: (_) => setState(() {}),
                        maxLength: 160,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Title',
                          hintText: 'A short, clear title',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _excerpt,
                        onChanged: (_) => setState(() {}),
                        maxLength: 300,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(
                          labelText: 'Excerpt (optional)',
                          hintText: 'One sentence that previews the post',
                          helperText:
                              'Left blank, the first 180 characters are used.',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _body,
                        onChanged: (_) => setState(() {}),
                        minLines: 12,
                        maxLines: 22,
                        maxLength: 20000,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(
                          labelText: 'Your post',
                          hintText: 'Leave a blank line between paragraphs.',
                          helperText: '$bodyLength / 100 minimum characters',
                          alignLabelWithHint: true,
                        ),
                      ),
                      const SizedBox(height: 10),
                      FilledButton.icon(
                        onPressed: _valid ? _submit : null,
                        icon: const Icon(LucideIcons.check, size: 15),
                        label: Text(
                          _submitting ? 'Submitting…' : 'Submit for review',
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
    );
  }
}
