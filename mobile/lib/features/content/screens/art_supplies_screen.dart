import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/launch.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/content.dart';
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/artwork_card.dart' show EmptyState;
import '../important_buys.dart';
import '../providers/content_providers.dart';

class ArtSuppliesScreen extends ConsumerStatefulWidget {
  const ArtSuppliesScreen({super.key});

  static const path = '/art-supplies';

  @override
  ConsumerState<ArtSuppliesScreen> createState() => _ArtSuppliesScreenState();
}

class _ArtSuppliesScreenState extends ConsumerState<ArtSuppliesScreen> {
  final _search = TextEditingController();
  String? _category;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(affiliateProductsProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Art supplies')),
      body: RefreshIndicator.adaptive(
        onRefresh: () async {
          ref.invalidate(affiliateProductsProvider);
          await ref.read(affiliateProductsProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            ContentWidth(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    "The artist's supply shelf",
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.tertiary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Art supplies we recommend',
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'GalleryZone picks the products; price, delivery, reviews and checkout stay on Amazon.',
                    style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'As an Amazon Associate, GalleryZone earns from qualifying purchases. It costs you nothing extra.',
                    style: theme.textTheme.labelSmall,
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      hintText: 'Search brushes, acrylics, canvas…',
                      prefixIcon: Icon(LucideIcons.search, size: 17),
                    ),
                  ),
                  const SizedBox(height: 14),
                  products.when(
                    loading: () => const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                    error: (error, stack) => EmptyState(
                      icon: LucideIcons.packageSearch,
                      title: "The shelf didn't load",
                      description: authErrorMessage(error),
                      action: OutlinedButton(
                        onPressed: () =>
                            ref.invalidate(affiliateProductsProvider),
                        child: const Text('Try again'),
                      ),
                    ),
                    data: (all) => _shelf(context, all),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _shelf(BuildContext context, List<AffiliateProduct> all) {
    final theme = Theme.of(context);
    final shown = shelfProducts(all, pill: _category, query: _search.text);
    final hasImportant = all.any((p) => p.category == importantBuysCategory);
    final others = ({
      for (final item in all)
        if (item.category != importantBuysCategory) item.category,
    }).toList()..sort();
    final segment = showsImportantSegment(
      shown,
      pill: _category,
      query: _search.text,
    );
    final important = segment
        ? [
            for (final p in shown)
              if (p.category == importantBuysCategory) p,
          ]
        : const <AffiliateProduct>[];
    final rest = segment
        ? [
            for (final p in shown)
              if (p.category != importantBuysCategory) p,
          ]
        : shown;

    Widget pill(String label, String? value) => Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: _category == value,
        onSelected: (_) =>
            setState(() => _category = _category == value ? null : value),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (others.isNotEmpty || hasImportant)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ChoiceChip(
                  label: Text('All ${all.length}'),
                  selected: _category == null,
                  onSelected: (_) => setState(() => _category = null),
                ),
                const SizedBox(width: 8),
                if (hasImportant)
                  pill(
                    '$importantBuysCategory ${all.where((p) => p.category == importantBuysCategory).length}',
                    importantBuysCategory,
                  ),
                pill('Newest', newestPill),
                for (final category in others)
                  pill(
                    '$category ${all.where((item) => item.category == category).length}',
                    category,
                  ),
              ],
            ),
          ),
        const SizedBox(height: 14),
        if (shown.isEmpty)
          EmptyState(
            icon: LucideIcons.packageSearch,
            title: all.isEmpty
                ? 'The shelf is being stocked'
                : 'Nothing matches that',
            description: all.isEmpty
                ? 'Our recommended supplies will appear here soon.'
                : 'Try a shorter search, or show every category.',
          )
        else ...[
          if (important.isNotEmpty)
            Container(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(
                  color: theme.colorScheme.primary.withValues(alpha: 0.3),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          importantBuysCategory,
                          style: theme.textTheme.titleLarge,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'What every artist needs to pack and send a piece out.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _SupplyGrid(products: important),
                ],
              ),
            ),
          if (rest.isNotEmpty) ...[
            if (important.isNotEmpty) ...[
              const SizedBox(height: 22),
              Text('All supplies', style: theme.textTheme.titleMedium),
              const SizedBox(height: 10),
            ],
            _SupplyGrid(products: rest),
          ],
        ],
      ],
    );
  }
}

/// The products as a grid: two to a row on a phone, more as the window widens.
/// A card's height follows its width and the text size, so the note about local
/// shops never overflows a narrow phone or a large font.
class _SupplyGrid extends StatelessWidget {
  const _SupplyGrid({required this.products});

  final List<AffiliateProduct> products;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 900
            ? 4
            : constraints.maxWidth >= 600
            ? 3
            : 2;
        const gap = 10.0;
        final cardWidth =
            (constraints.maxWidth - gap * (columns - 1)) / columns;
        final textScale = MediaQuery.textScalerOf(context)
            .scale(1)
            .clamp(1.0, 1.6);
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: products.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: gap,
            mainAxisSpacing: gap,
            mainAxisExtent: 214 * textScale + cardWidth * 0.8,
          ),
          itemBuilder: (context, index) =>
              _SupplyCard(product: products[index]),
        );
      },
    );
  }
}

class _SupplyCard extends StatelessWidget {
  const _SupplyCard({required this.product});

  final AffiliateProduct product;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cover = product.images.firstOrNull;
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outline),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              clipBehavior: Clip.antiAlias,
              child: cover == null
                  ? const Center(
                      child: Icon(LucideIcons.package, color: Colors.black38),
                    )
                  : Image.network(
                      cover,
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => const Icon(
                        LucideIcons.package,
                        color: Colors.black38,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 9),
          if ((product.brand ?? '').isNotEmpty)
            Text(
              product.brand!.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelSmall,
            ),
          Text(
            product.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            product.category,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.tertiary,
            ),
          ),
          if (buyableLocally(product))
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                localShopNote,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall?.copyWith(
                  fontSize: 10.5,
                  height: 1.25,
                ),
              ),
            ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: product.url.isEmpty
                ? null
                : () => openExternal(context, product.url),
            icon: const Icon(LucideIcons.externalLink, size: 13),
            label: const Text('View on Amazon'),
          ),
        ],
      ),
    );
  }
}
