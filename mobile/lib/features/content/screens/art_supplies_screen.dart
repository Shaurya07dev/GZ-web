import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/launch.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/content.dart';
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/artwork_card.dart' show EmptyState;
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

  bool _matches(AffiliateProduct product) {
    if (_category != null && product.category != _category) return false;
    final words = _search.text
        .toLowerCase()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty);
    final text = '${product.title} ${product.brand ?? ''} ${product.category}'
        .toLowerCase();
    return words.every(text.contains);
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(affiliateProductsProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Art supplies')),
      body: RefreshIndicator(
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
                    data: (all) {
                      final categories =
                          all.map((item) => item.category).toSet().toList()
                            ..sort();
                      final shown = all.where(_matches).toList();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (categories.length > 1)
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  ChoiceChip(
                                    label: Text('All ${all.length}'),
                                    selected: _category == null,
                                    onSelected: (_) =>
                                        setState(() => _category = null),
                                  ),
                                  for (final category in categories) ...[
                                    const SizedBox(width: 8),
                                    ChoiceChip(
                                      label: Text(
                                        '$category ${all.where((item) => item.category == category).length}',
                                      ),
                                      selected: _category == category,
                                      onSelected: (_) => setState(
                                        () => _category = _category == category
                                            ? null
                                            : category,
                                      ),
                                    ),
                                  ],
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
                          else
                            LayoutBuilder(
                              builder: (context, constraints) {
                                final columns = constraints.maxWidth >= 900
                                    ? 4
                                    : constraints.maxWidth >= 600
                                    ? 3
                                    : 2;
                                return GridView.builder(
                                  shrinkWrap: true,
                                  physics: const NeverScrollableScrollPhysics(),
                                  itemCount: shown.length,
                                  gridDelegate:
                                      SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: columns,
                                        childAspectRatio: 0.65,
                                        crossAxisSpacing: 10,
                                        mainAxisSpacing: 10,
                                      ),
                                  itemBuilder: (context, index) =>
                                      _SupplyCard(product: shown[index]),
                                );
                              },
                            ),
                        ],
                      );
                    },
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
