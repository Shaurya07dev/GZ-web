import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/artwork_card.dart';
import '../../ownership/widgets/transfer_widgets.dart';
import '../../shell/portal_widgets.dart';
import '../providers/account_providers.dart';
import 'collection_screen.dart' show NfcPill, PaperCertificate;

/// A collector-facing index of every certificate, physical-tag state and
/// ownership action. The collection detail keeps these controls too; this is
/// the web-equivalent board that makes them discoverable in one place.
class CustomerCoaNfcScreen extends ConsumerWidget {
  const CustomerCoaNfcScreen({super.key});

  static const path = '/account/coa-nfc';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final collection = ref.watch(collectionProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('COA & NFC')),
      body: collection.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.triangleAlert,
          title: "Certificates didn't load",
          description: authErrorMessage(error),
          action: OutlinedButton(
            onPressed: () => ref.invalidate(collectionProvider),
            child: const Text('Try again'),
          ),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref
              ..invalidate(collectionProvider)
              ..invalidate(physicalCoaRequestsProvider);
            await ref.read(collectionProvider.future);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
            children: [
              ContentWidth(
                maxWidth: 820,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Certificates & tags',
                      style: theme.textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Every owned piece carries its digital Certificate of Authenticity. Physical pieces can '
                      'also carry a locked NFC/QR identity tag.',
                      style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                    ),
                    const SizedBox(height: 18),
                    if (items.isEmpty)
                      EmptyState(
                        icon: LucideIcons.fingerprint,
                        title: 'No certificates yet',
                        description: 'Once an order is delivered, its certificate and tag state appear here.',
                        action: OutlinedButton(
                          onPressed: () => context.push('/marketplace'),
                          child: const Text('Browse the marketplace'),
                        ),
                      )
                    else
                      for (final item in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: PortalCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(
                                        AppRadius.sm,
                                      ),
                                      child: SizedBox(
                                        width: 76,
                                        height: 76,
                                        child: ArtworkImageView(
                                          url: item.artwork.thumbnailUrl,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item.artwork.title,
                                            style: theme.textTheme.titleMedium,
                                          ),
                                          Text(
                                            item.artwork.artistName,
                                            style: theme.textTheme.bodySmall,
                                          ),
                                          const SizedBox(height: 8),
                                          Wrap(
                                            spacing: 6,
                                            runSpacing: 6,
                                            children: [
                                              StatusPill(
                                                label:
                                                    item
                                                        .artwork
                                                        .coaCertificateNumber
                                                        .isEmpty
                                                    ? 'COA pending'
                                                    : 'COA issued',
                                                color:
                                                    item
                                                        .artwork
                                                        .coaCertificateNumber
                                                        .isEmpty
                                                    ? theme
                                                          .colorScheme
                                                          .onSurfaceVariant
                                                    : const Color(0xFF34D399),
                                                icon: LucideIcons.badgeCheck,
                                              ),
                                              NfcPill(
                                                linked:
                                                    item.artwork.nfcLinkedAt !=
                                                    null,
                                                locked:
                                                    item.artwork.nfcLockedAt !=
                                                    null,
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const Divider(height: 26),
                                PaperCertificate(artwork: item.artwork),
                                const SizedBox(height: 10),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    OutlinedButton.icon(
                                      onPressed: () => context.push(
                                        '/verify/${item.artwork.id}',
                                      ),
                                      icon: const Icon(
                                        LucideIcons.externalLink,
                                        size: 14,
                                      ),
                                      label: const Text('View passport'),
                                    ),
                                    OutlinedButton.icon(
                                      onPressed: () =>
                                          showTransferOwnershipSheet(
                                            context,
                                            ref,
                                            artwork: item.artwork,
                                            fromName:
                                                ref
                                                    .read(
                                                      customerProfileProvider,
                                                    )
                                                    .value
                                                    ?.name ??
                                                'The owner',
                                          ),
                                      icon: const Icon(
                                        LucideIcons.userRoundCheck,
                                        size: 14,
                                      ),
                                      label: const Text('Transfer rights'),
                                    ),
                                  ],
                                ),
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
      ),
    );
  }
}
