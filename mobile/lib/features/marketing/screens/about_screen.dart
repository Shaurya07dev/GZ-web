import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/launch.dart';
import '../../../data/models/auth.dart';
import '../../../data/models/artwork.dart' show SocialProofPlatform;
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/social_glyphs.dart';
import '../../legal/screens/faq_screen.dart';
import '../../legal/screens/legal_document_screen.dart';
import '../../content/screens/art_supplies_screen.dart';
import '../../content/screens/blogs_screen.dart';
import '../../shell/portal_widgets.dart';

/// The company and legal hub.
///
/// The legal documents and the FAQ are native screens (`features/legal/`) —
/// they are what a reader needs in front of them while signing something, so
/// they ship with the app and work offline. The wording is generated from the
/// web's own content files, which is what keeps the two from drifting.
///
/// The marketing pages — the landing page, About, Contact, the artist survey
/// — still open the website, because they change on the web team's schedule
/// and nothing in the app depends on their text.
class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  static const path = '/about';

  @visibleForTesting
  static const companyLinks =
      <({IconData icon, String label, String subtitle, String path})>[
        // "About GalleryZone" and "Contact us" removed on 10 Nov 2026 —
        // this screen itself IS the About page (brand card + legal +
        // email contact further down), so external links to the same
        // content were redundant and confusing. Artist survey stays
        // because the web form captures different state.
        (
          icon: LucideIcons.clipboardList,
          label: 'Artist survey',
          subtitle: 'Help shape the Early Artist Program',
          path: '/artist-survey',
        ),
      ];

  @visibleForTesting
  static const legalDocs = <({LegalDoc doc, IconData icon, String subtitle})>[
    (
      doc: LegalDoc.terms,
      icon: LucideIcons.scale,
      subtitle: 'The agreement covering your use of GalleryZone',
    ),
    (
      doc: LegalDoc.privacy,
      icon: LucideIcons.shieldCheck,
      subtitle: 'What we collect and what we do with it',
    ),
    (
      doc: LegalDoc.cookies,
      icon: LucideIcons.cookie,
      subtitle: 'Cookies the website sets, and why',
    ),
    (
      doc: LegalDoc.artistTerms,
      icon: LucideIcons.palette,
      subtitle: 'Listing, verification, pricing and settlement',
    ),
    (
      doc: LegalDoc.aggregatorTerms,
      icon: LucideIcons.building2,
      subtitle: 'Display, custody, commission and returns',
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    // Role-filter the terms: artists see only artist terms, aggregators
    // see only aggregator terms, others see neither (they don't apply).
    // Client-reported 10 Nov 2026 — an artist was seeing aggregator
    // terms because the list carried both.
    final role = ref.watch(sessionProvider);
    final legalDocsForRole = [
      for (final item in legalDocs)
        if (!_isRoleTerms(item.doc) ||
            (item.doc == LegalDoc.artistTerms && role == Role.artist) ||
            (item.doc == LegalDoc.aggregatorTerms &&
                role == Role.aggregator))
          item,
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          ContentWidth(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PortalCard(
                  gold: true,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            'GZ',
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: theme.colorScheme.tertiary,
                              fontStyle: FontStyle.italic,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            'GALLERYZONE',
                            style: theme.textTheme.labelMedium?.copyWith(
                              letterSpacing: 3,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Where original art finds its identity.',
                        style: theme.textTheme.titleLarge?.copyWith(
                          height: 1.25,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'GalleryZone gives every artwork a trusted digital identity, a '
                        'verifiable history, and a global stage to be discovered.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          height: 1.55,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                for (final item in companyLinks) _LinkRow(item: item),
                const SizedBox(height: 20),
                Text('Discover', style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    LucideIcons.penTool,
                    size: 20,
                    color: theme.colorScheme.tertiary,
                  ),
                  title: Text(
                    'Artist blogs',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Studio stories reviewed by GalleryZone',
                    style: theme.textTheme.labelSmall,
                  ),
                  trailing: const Icon(Icons.chevron_right, size: 18),
                  onTap: () => context.push(BlogsScreen.path),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    LucideIcons.paintbrush,
                    size: 20,
                    color: theme.colorScheme.tertiary,
                  ),
                  title: Text(
                    'Art supplies',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Recommended tools that open on Amazon',
                    style: theme.textTheme.labelSmall,
                  ),
                  trailing: const Icon(Icons.chevron_right, size: 18),
                  onTap: () => context.push(ArtSuppliesScreen.path),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    LucideIcons.circleHelp,
                    size: 20,
                    color: theme.colorScheme.tertiary,
                  ),
                  title: Text(
                    'Frequently asked questions',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Buying, selling, authenticity and delivery',
                    style: theme.textTheme.labelSmall,
                  ),
                  trailing: const Icon(Icons.chevron_right, size: 18),
                  onTap: () => context.push(FaqScreen.path),
                ),
                const SizedBox(height: 20),
                Text('Legal', style: theme.textTheme.titleLarge),
                const SizedBox(height: 4),
                Text(
                  'Read in full here — these ship with the app, so they work '
                  'offline and match this build.',
                  style: theme.textTheme.labelSmall?.copyWith(height: 1.4),
                ),
                const SizedBox(height: 8),
                for (final item in legalDocsForRole)
                  LegalDocRow(
                    doc: item.doc,
                    icon: item.icon,
                    subtitle: item.subtitle,
                  ),
                const SizedBox(height: 24),
                Text('Get in touch', style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                ContactLinkRow(
                  icon: LucideIcons.mail,
                  label: galleryZoneEmail,
                  url: 'mailto:$galleryZoneEmail',
                ),
                // Instagram only. The web footer also renders X and LinkedIn
                // marks, but both point at "#" there — no account exists yet,
                // and a tap that goes nowhere is worse than an absent icon.
                ContactLinkRow(
                  glyph: const SocialGlyph(
                    platform: SocialProofPlatform.instagram,
                    size: 16,
                  ),
                  label: '@galleryzone.in',
                  url: 'https://www.instagram.com/galleryzone.in',
                ),
                const SizedBox(height: 24),
                Center(
                  child: TextButton.icon(
                    onPressed: () => openExternal(context, galleryZoneSite),
                    icon: const Icon(LucideIcons.externalLink, size: 15),
                    label: const Text('Visit galleryzone.in'),
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

/// Terms that only apply to one specific role; the About screen hides the
/// one that doesn't belong to the viewer.
bool _isRoleTerms(LegalDoc doc) =>
    doc == LegalDoc.artistTerms || doc == LegalDoc.aggregatorTerms;

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.item});

  final ({IconData icon, String label, String subtitle, String path}) item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(item.icon, size: 20, color: theme.colorScheme.tertiary),
      title: Text(item.label, style: theme.textTheme.bodyMedium),
      subtitle: Text(item.subtitle, style: theme.textTheme.labelSmall),
      trailing: const Icon(LucideIcons.externalLink, size: 15),
      onTap: () => openExternal(context, '$galleryZoneSite${item.path}'),
    );
  }
}
