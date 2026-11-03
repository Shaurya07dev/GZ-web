import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/motion.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/artwork.dart';
import '../../marketplace/providers/marketplace_providers.dart';
import '../../marketplace/widgets/artwork_card.dart'
    show ArtworkImageView, EmptyState;
import '../providers/account_providers.dart';

/// Port of the web `/cart` page. Each entry is re-fetched through the
/// shared artwork provider so a sold or delisted piece naturally drops out
/// (the server already removed the piece from the cart only on an explicit
/// remove, so the UI handles stale items gracefully by showing them in a
/// separate "no longer available" group).
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  static const path = '/account/cart';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final cartAsync = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Your cart')),
      body: cartAsync.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.triangleAlert,
          title: "Couldn't load your cart",
          description: 'Please try again in a moment.',
          action: OutlinedButton(
            onPressed: () => ref.invalidate(cartProvider),
            child: const Text('Retry'),
          ),
        ),
        data: (cart) {
          if (cart.isEmpty) {
            return EmptyState(
              icon: LucideIcons.shoppingCart,
              title: 'Your cart is empty',
              description:
                  "Browse the marketplace and tap Add to cart on anything you're thinking about.",
              action: FilledButton(
                onPressed: () => context.push('/marketplace'),
                child: const Text('Browse the marketplace'),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(cartProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Text(
                  'Checkout one piece at a time — each artwork is an original and ships direct from the artist.',
                  style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                ),
                const SizedBox(height: 20),
                for (final entry in cart.entries) ...[
                  _CartRow(artworkId: entry.artworkId),
                  const SizedBox(height: 10),
                ],
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () async {
                    await ref.read(customerRepositoryProvider).clearCart();
                    ref.invalidate(cartProvider);
                  },
                  icon: const Icon(LucideIcons.trash2, size: 14),
                  label: const Text('Clear cart'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// One cart row — reads the artwork fresh so sold / delisted pieces show
/// a different pill and a clear "remove" button.
class _CartRow extends ConsumerWidget {
  const _CartRow({required this.artworkId});

  final String artworkId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final artworkAsync = ref.watch(artworkProvider(artworkId));
    return artworkAsync.when(
      loading: () => const _CartRowSkeleton(),
      error: (_, _) => _MissingRow(artworkId: artworkId, label: 'Not available'),
      data: (artwork) {
        if (artwork == null) {
          return _MissingRow(artworkId: artworkId, label: 'No longer listed');
        }
        final isAvailable = artwork.status == ArtworkStatus.marketplace;
        return Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: theme.colorScheme.surfaceContainerLow,
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: theme.colorScheme.outline.withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                child: SizedBox(
                  width: 80,
                  height: 100,
                  child: ArtworkImageView(url: artwork.thumbnailUrl),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      artwork.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      artwork.artistName,
                      style: theme.textTheme.labelSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      formatInr(artwork.customerPrice),
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: theme.colorScheme.tertiary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (!isAvailable) ...[
                      const SizedBox(height: 4),
                      Text(
                        'This piece has been reserved or sold since you added it.',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.error,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        if (isAvailable)
                          FilledButton(
                            onPressed: () =>
                                context.push('/checkout?artworkId=${artwork.id}'),
                            child: const Text('Checkout'),
                          ),
                        TextButton.icon(
                          onPressed: () async {
                            await ref
                                .read(customerRepositoryProvider)
                                .removeFromCart(artwork.id);
                            ref.invalidate(cartProvider);
                          },
                          icon: const Icon(LucideIcons.x, size: 12),
                          label: const Text('Remove'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CartRowSkeleton extends StatelessWidget {
  const _CartRowSkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 110,
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
    );
  }
}

class _MissingRow extends ConsumerWidget {
  const _MissingRow({required this.artworkId, required this.label});

  final String artworkId;
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Icon(
            LucideIcons.triangleAlert,
            size: 16,
            color: theme.colorScheme.error,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: theme.textTheme.bodySmall),
          ),
          TextButton(
            onPressed: () async {
              await ref
                  .read(customerRepositoryProvider)
                  .removeFromCart(artworkId);
              ref.invalidate(cartProvider);
            },
            child: const Text('Remove'),
          ),
        ],
      ),
    );
  }
}
