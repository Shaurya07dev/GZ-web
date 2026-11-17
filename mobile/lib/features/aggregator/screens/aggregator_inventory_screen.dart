import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/motion.dart';
import '../../../core/pricing.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/aggregator.dart';
import '../../../data/models/artwork.dart';
import '../../../data/models/artist_portal.dart';
import '../../../data/repositories/aggregator_repository.dart';
import '../../account/widgets/notification_bell.dart';
import '../../marketplace/providers/marketplace_providers.dart'
    show wishlistProvider;
import '../../marketplace/widgets/artwork_card.dart';
import '../../shell/portal_widgets.dart';
import '../inventory_filters.dart';
import '../providers/aggregator_providers.dart';
import '../reserve_requirements.dart';
import '../widgets/aggregator_widgets.dart';

/// Port of `app/aggregator/inventory/page.tsx` + `reservable-inventory-grid.tsx` -
/// the web's "Browse GalleryZone". Artworks eligible for aggregator display that
/// nobody has claimed yet; reserving one pays the advance and moves it to
/// Inventory.
///
/// The web's search box, category chips and sort menu are decorative there (they
/// filter and sort nothing); here they work.
class AggregatorBrowseScreen extends ConsumerStatefulWidget {
  const AggregatorBrowseScreen({super.key});

  static const path = '/aggregator/inventory';

  @override
  ConsumerState<AggregatorBrowseScreen> createState() =>
      _AggregatorBrowseScreenState();
}

class _AggregatorBrowseScreenState
    extends ConsumerState<AggregatorBrowseScreen> {
  final _search = TextEditingController();
  String _query = '';
  InventoryFilters _filters = const InventoryFilters();
  InventorySort _sort = InventorySort.newest;
  bool _grid = true;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  List<ReservableArtwork> _visible(
    List<ReservableArtwork> all,
    Set<String> saved,
  ) => applyInventory(all, _query, _filters, _sort, saved: saved);

  void _clearAll() {
    _search.clear();
    setState(() {
      _query = '';
      _filters = const InventoryFilters();
    });
  }

  void _openFilters(List<ReservableArtwork> all, Set<String> saved) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => _FiltersSheet(
        items: all,
        query: _query,
        sort: _sort,
        saved: saved,
        initial: _filters,
        onChanged: (value) => setState(() => _filters = value),
      ),
    );
  }

  void _reserve(ReservableArtwork item) {
    final requirements = ref.read(reserveRequirementsProvider);
    if (requirements.blockedReason != null) {
      showReserveBlockedDialog(context, requirements);
      return;
    }
    context.push('/aggregator/inventory/${item.artwork.id}/reserve');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final inventory = ref.watch(aggregatorInventoryProvider);
    final saved = ref.watch(wishlistProvider);
    // What this aggregator holds or has sold is what "suggested for you" is
    // measured against. A returned piece wasn't theirs to show, so it doesn't count.
    final held = [
      for (final view
          in ref.watch(aggregatorCollectionProvider).value ??
              const <AggregatorHoldingView>[])
        if (view.holding.status != HoldingStatus.returned) view.artwork,
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Browse GalleryZone'),
        actions: const [NotificationBell(), SizedBox(width: 4)],
      ),
      body: inventory.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.packageSearch,
          title: "Couldn't load inventory",
          description: 'Something went wrong loading reservable artworks.',
          action: OutlinedButton(
            onPressed: () => ref.invalidate(aggregatorInventoryProvider),
            child: const Text('Try again'),
          ),
        ),
        data: (all) {
          if (all.isEmpty) {
            return const EmptyState(
              icon: LucideIcons.packageSearch,
              title: 'No reservable artworks right now',
              description: 'Every marketplace-and-aggregator artwork is already claimed. Check back soon as new work is listed.',
            );
          }
          final categories = ({
            for (final item in all) item.artwork.category,
          }..remove('')).toList()..sort();
          final visible = _visible(all, saved);
          final savedOnShelf = all
              .where((i) => saved.contains(i.artwork.id))
              .length;
          final badge = activeFilterCount(_filters);

          return RefreshIndicator.adaptive(
            onRefresh: () async {
              ref.invalidate(aggregatorInventoryProvider);
              await ref.read(aggregatorInventoryProvider.future);
            },
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: _ContentColumn(
                      children: [
                        Text(
                          'Browse artworks available for aggregator display. Reserving pays '
                          'the advance and moves a piece into your Collection.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 16),
                        // The API refuses a reservation without a signed MOU and an
                        // approved GST number. Say so here rather than letting someone
                        // pick a piece and hit the wall on the reserve screen.
                        const ReserveRequirementsNotice(),
                        if (held.isNotEmpty) ...[
                          SuggestedArtworks(
                            references: held,
                            title: 'Suggested for you',
                            limit: 6,
                          ),
                          const SizedBox(height: 20),
                        ],
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _search,
                                textInputAction: TextInputAction.search,
                                onChanged: (value) =>
                                    setState(() => _query = value),
                                decoration: InputDecoration(
                                  hintText:
                                      'Search artworks, artists, or styles...',
                                  prefixIcon: const Icon(
                                    LucideIcons.search,
                                    size: 16,
                                  ),
                                  suffixIcon: _query.isEmpty
                                      ? null
                                      : IconButton(
                                          tooltip: 'Clear search',
                                          icon: const Icon(
                                            LucideIcons.x,
                                            size: 16,
                                          ),
                                          onPressed: () {
                                            _search.clear();
                                            setState(() => _query = '');
                                          },
                                        ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            _FiltersButton(
                              count: badge,
                              onTap: () => _openFilters(all, saved),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          height: 36,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              if (categories.length > 1)
                                for (final category in [null, ...categories])
                                  Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: ChoiceChip(
                                      label: Text(category ?? 'All'),
                                      selected: _filters.category == category,
                                      onSelected: (_) => setState(
                                        () => _filters = _filters.copyWith(
                                          category: category,
                                        ),
                                      ),
                                    ),
                                  ),
                              ChoiceChip(
                                avatar: Icon(
                                  savedOnShelf > 0 || _filters.savedOnly
                                      ? Icons.favorite
                                      : Icons.favorite_border,
                                  size: 14,
                                  color: Theme.of(context).colorScheme.tertiary,
                                ),
                                label: Text('Saved $savedOnShelf'),
                                selected: _filters.savedOnly,
                                onSelected: (value) => setState(
                                  () => _filters = _filters.copyWith(
                                    savedOnly: value,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        _ResultsBar(
                          count: visible.length,
                          sort: _sort,
                          grid: _grid,
                          onSort: (value) =>
                              setState(() => _sort = value ?? _sort),
                          onToggleView: () => setState(() => _grid = !_grid),
                        ),
                        const SizedBox(height: 8),
                      ],
                    ),
                  ),
                ),
                if (visible.isEmpty)
                  SliverToBoxAdapter(
                    child: EmptyState(
                      icon: LucideIcons.packageSearch,
                      title: 'Nothing matches',
                      description: _filters.savedOnly && saved.isEmpty
                          ? 'Tap the heart on a piece to save it for later.'
                          : 'Try a different search or category.',
                      action: isFiltering(_query, _filters)
                          ? OutlinedButton(
                              onPressed: _clearAll,
                              child: const Text('Clear search and filters'),
                            )
                          : null,
                    ),
                  )
                else if (_grid)
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                    // The card's height follows its width and the phone's text size:
                    // a narrow screen wraps more lines of text, and a fixed height
                    // squeezed the photo (or overflowed) on the smallest phones.
                    sliver: SliverLayoutBuilder(
                      builder: (context, constraints) {
                        const maxExtent = 260.0;
                        const gap = 14.0;
                        final columns =
                            ((constraints.crossAxisExtent + gap) /
                                    (maxExtent + gap))
                                .ceil();
                        final cardWidth =
                            (constraints.crossAxisExtent -
                                gap * (columns - 1)) /
                            columns;
                        final textScale = MediaQuery.textScalerOf(context)
                            .scale(1)
                            .clamp(1.0, 1.6);
                        return SliverGrid(
                          gridDelegate:
                              SliverGridDelegateWithMaxCrossAxisExtent(
                                maxCrossAxisExtent: maxExtent,
                                mainAxisSpacing: gap,
                                crossAxisSpacing: gap,
                                mainAxisExtent:
                                    292 * textScale + cardWidth * 0.85,
                              ),
                          delegate: SliverChildBuilderDelegate(
                            (context, index) => _ReservableCard(
                              item: visible[index],
                              onReserve: () => _reserve(visible[index]),
                              saved: saved.contains(visible[index].artwork.id),
                              onToggleSaved: () => ref
                                  .read(wishlistProvider.notifier)
                                  .toggle(visible[index].artwork.id),
                            ),
                            childCount: visible.length,
                          ),
                        );
                      },
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                    sliver: SliverList.separated(
                      itemCount: visible.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 12),
                      itemBuilder: (context, index) => _ContentColumn(
                        children: [
                          _ReservableRow(
                            item: visible[index],
                            onReserve: () => _reserve(visible[index]),
                            saved: saved.contains(visible[index].artwork.id),
                            onToggleSaved: () => ref
                                .read(wishlistProvider.notifier)
                                .toggle(visible[index].artwork.id),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// "N artworks available", the sort menu and the grid/list switch - one line on a
/// wide window, two on a phone (the count, then the controls), as the web does.
class _ResultsBar extends StatelessWidget {
  const _ResultsBar({
    required this.count,
    required this.sort,
    required this.grid,
    required this.onSort,
    required this.onToggleView,
  });

  final int count;
  final InventorySort sort;
  final bool grid;
  final ValueChanged<InventorySort?> onSort;
  final VoidCallback onToggleView;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = Text(
      '$count artwork${count == 1 ? '' : 's'} available',
      style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
    );
    final menu = DropdownButtonHideUnderline(
      child: DropdownButton<InventorySort>(
        value: sort,
        isExpanded: true,
        isDense: true,
        style: theme.textTheme.labelLarge,
        items: [
          for (final option in InventorySort.values)
            DropdownMenuItem(
              value: option,
              child: Text(
                'Sort: ${option.label}',
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
        onChanged: onSort,
      ),
    );
    final toggle = IconButton(
      tooltip: grid ? 'List view' : 'Grid view',
      visualDensity: VisualDensity.compact,
      icon: Icon(grid ? LucideIcons.list : LucideIcons.layoutGrid, size: 18),
      onPressed: onToggleView,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 560;
        final controls = Row(
          children: [
            if (wide)
              SizedBox(width: 220, child: menu)
            else
              Expanded(child: menu),
            const SizedBox(width: 4),
            toggle,
          ],
        );
        return wide
            ? Row(
                children: [
                  Expanded(child: label),
                  controls,
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [label, const SizedBox(height: 4), controls],
              );
      },
    );
  }
}

/// A centred, width-capped column - the header and list rows share it so text
/// and rows stay readable on a tablet while the grid fills the window.
class _ContentColumn extends StatelessWidget {
  const _ContentColumn({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    );
  }
}

/// Month 1 is the aggregator's to price; after that GalleryZone's ladder steps
/// the price down. Said the same way on the card and the list row.
String monthLine(AggregatorOffer offer) {
  final month = 'Month ${offer.month} of $aggregatorCycleMonths';
  if (offer.canSetPrice) return '$month · you set the price';
  return offer.monthlyReduction > 0
      ? '$month · ${formatInr(offer.monthlyReduction)} off month 1'
      : month;
}

String _priceNote(AggregatorOffer offer) => offer.canSetPrice
    ? "GalleryZone's price, incl. GST. You can set a higher one."
    : 'Fixed this month, incl. GST';

/// Initial in a gold disc, then the artist's name and the verified mark.
class _ArtistLine extends StatelessWidget {
  const _ArtistLine({required this.item});

  final ReservableArtwork item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final artwork = item.artwork;
    return Row(
      children: [
        CircleAvatar(
          radius: 9,
          backgroundColor: theme.colorScheme.primary.withValues(alpha: 0.15),
          child: Text(
            artwork.artistName.isEmpty
                ? ''
                : artwork.artistName.characters.first.toUpperCase(),
            style: theme.textTheme.labelSmall?.copyWith(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: theme.colorScheme.tertiary,
            ),
          ),
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            artwork.artistName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall,
          ),
        ),
        if (artwork.verifiedArtist) ...[
          const SizedBox(width: 4),
          const VerifiedBadge(
            verification: VerifiedBadge.minimumVerification,
            small: true,
          ),
        ],
      ],
    );
  }
}

/// Where this month sits in the five, and what it means for the price.
class _CycleBox extends StatelessWidget {
  const _CycleBox({required this.offer});

  final AggregatorOffer offer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final line = monthLine(offer);
    // "Month 1 of 5" leads in the ink colour; what it means for the price
    // follows in gold. One Text, so a screen reader reads it as one sentence.
    final split = line.indexOf(' · ');
    final lead = split < 0 ? line : line.substring(0, split);
    final rest = split < 0 ? '' : line.substring(split);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: theme.colorScheme.primary.withValues(alpha: 0.22),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CycleStepper(currentMonth: offer.month, small: true),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: lead,
                  style: TextStyle(color: theme.colorScheme.onSurface),
                ),
                TextSpan(
                  text: rest,
                  style: TextStyle(color: theme.colorScheme.tertiary),
                ),
              ],
            ),
            textAlign: TextAlign.center,
            style: theme.textTheme.labelSmall?.copyWith(
              fontSize: 10.5,
              height: 1.3,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReservableCard extends StatelessWidget {
  const _ReservableCard({
    required this.item,
    required this.onReserve,
    required this.saved,
    required this.onToggleSaved,
  });

  final ReservableArtwork item;
  final VoidCallback onReserve;
  final bool saved;
  final VoidCallback onToggleSaved;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final artwork = item.artwork;
    final offer = item.offer;
    // Opens the public marketplace page - the aggregator sees exactly what a
    // collector would before committing an advance.
    void open() => context.push('/marketplace/${artwork.id}');

    return PortalCard(
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: GestureDetector(
              onTap: open,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: ArtworkImageView(url: artwork.thumbnailUrl),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: _SaveButton(saved: saved, onTap: onToggleSaved),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: open,
            child: Text(
              artwork.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
                height: 1.25,
              ),
            ),
          ),
          const SizedBox(height: 4),
          _ArtistLine(item: item),
          const SizedBox(height: 6),
          PriceTag(
            amount: offer.offerPrice,
            style: theme.textTheme.titleMedium,
          ),
          Text(
            _priceNote(offer),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.labelSmall?.copyWith(fontSize: 10.5),
          ),
          const SizedBox(height: 10),
          _CycleBox(offer: offer),
          const SizedBox(height: 12),
          SizedBox(
            height: 42,
            child: FilledButton(
              onPressed: onReserve,
              // One line at any card width: the label shrinks a touch rather
              // than breaking into "Reserve / Artwork" on a narrow phone.
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: const FittedBox(
                fit: BoxFit.scaleDown,
                child: Text('Reserve Artwork', maxLines: 1, softWrap: false),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReservableRow extends StatelessWidget {
  const _ReservableRow({
    required this.item,
    required this.onReserve,
    required this.saved,
    required this.onToggleSaved,
  });

  final ReservableArtwork item;
  final VoidCallback onReserve;
  final bool saved;
  final VoidCallback onToggleSaved;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final artwork = item.artwork;
    final offer = item.offer;
    void open() => context.push('/marketplace/${artwork.id}');

    return PortalCard(
      padding: const EdgeInsets.all(10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: open,
            child: SizedBox(
              width: 96,
              height: 128,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: ArtworkImageView(url: artwork.thumbnailUrl),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: _SaveButton(saved: saved, onTap: onToggleSaved),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: open,
                  child: Text(
                    artwork.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      height: 1.25,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                _ArtistLine(item: item),
                if (artwork.medium.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      artwork.medium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall,
                    ),
                  ),
                const SizedBox(height: 6),
                PriceTag(
                  amount: offer.offerPrice,
                  style: theme.textTheme.titleSmall,
                ),
                Text(
                  _priceNote(offer),
                  style: theme.textTheme.labelSmall?.copyWith(fontSize: 10.5),
                ),
                const SizedBox(height: 8),
                _CycleBox(offer: offer),
                const SizedBox(height: 8),
                SizedBox(
                  height: 38,
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: onReserve,
                    child: const Text('Reserve'),
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

/// The heart on a photo: a round, readable-on-any-picture target of its own,
/// 40 dp for the thumb with the heart itself drawn smaller.
class _SaveButton extends StatelessWidget {
  const _SaveButton({required this.saved, required this.onTap});

  final bool saved;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: saved ? 'Remove from saved' : 'Save for later',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Center(
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.88),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.16),
                    blurRadius: 6,
                  ),
                ],
              ),
              child: Center(
                child: WishlistHeart(
                  saved: saved,
                  size: 16,
                  color: Colors.black54,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FiltersButton extends StatelessWidget {
  const _FiltersButton({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      label: count == 0 ? 'Filters' : 'Filters, $count set',
      excludeSemantics: true,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: const Icon(LucideIcons.slidersHorizontal, size: 16),
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Filters'),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                constraints: const BoxConstraints(minWidth: 18),
                height: 18,
                padding: const EdgeInsets.symmetric(horizontal: 5),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Text(
                  '$count',
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.onPrimary,
                  ),
                ),
              ),
            ],
          ],
        ),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 12),
        ),
      ),
    );
  }
}

String _bandLabel(int i) {
  final band = inventoryPriceBands[i];
  if (band.min == null) return 'Under ${formatInr(band.max!)}';
  if (band.max == null) return 'Above ${formatInr(band.min!)}';
  return '${formatInr(band.min!)} \u2013 ${formatInr(band.max!)}';
}

List<T> _toggled<T>(List<T> list, T value) {
  final next = [...list];
  if (!next.remove(value)) next.add(value);
  return next;
}

/// Price, medium, size, rank and the artist/edition switches, with how many
/// pieces each option has. Only what is on the shelf is offered, so no choice
/// leads to an empty page. Changes apply to the page behind the sheet as they
/// are made; "Show N artworks" just closes it.
class _FiltersSheet extends StatefulWidget {
  const _FiltersSheet({
    required this.items,
    required this.query,
    required this.sort,
    required this.saved,
    required this.initial,
    required this.onChanged,
  });

  final List<ReservableArtwork> items;
  final String query;
  final InventorySort sort;
  final Set<String> saved;
  final InventoryFilters initial;
  final ValueChanged<InventoryFilters> onChanged;

  @override
  State<_FiltersSheet> createState() => _FiltersSheetState();
}

class _FiltersSheetState extends State<_FiltersSheet> {
  late InventoryFilters _f = widget.initial;

  void _set(InventoryFilters next) {
    setState(() => _f = next);
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final facets = inventoryFacets(widget.items);
    final matching = applyInventory(
      widget.items,
      widget.query,
      _f,
      widget.sort,
      saved: widget.saved,
    ).length;
    final badge = activeFilterCount(_f);

    Widget group(String title, List<Widget> chips) => Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: theme.textTheme.titleSmall),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: chips),
        ],
      ),
    );

    Widget chip(String label, int count, bool selected, VoidCallback onTap) =>
        FilterChip(
          label: Text('$label  $count'),
          selected: selected,
          onSelected: (_) => onTap(),
        );

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.82,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 12, 4),
            child: Row(
              children: [
                Expanded(
                  child: Text('Filters', style: theme.textTheme.titleLarge),
                ),
                TextButton(
                  onPressed: badge == 0 ? null : () => _set(_f.clearedPanel()),
                  child: const Text('Reset'),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              children: [
                if (facets.prices.any((n) => n > 0))
                  group('Price', [
                    for (var i = 0; i < inventoryPriceBands.length; i++)
                      if (facets.prices[i] > 0 || _f.price == i)
                        chip(
                          _bandLabel(i),
                          facets.prices[i],
                          _f.price == i,
                          () => _set(
                            _f.copyWith(price: _f.price == i ? null : i),
                          ),
                        ),
                  ]),
                if (facets.mediums.isNotEmpty)
                  group('Medium', [
                    for (final (medium, count) in facets.mediums)
                      chip(
                        humanize(medium),
                        count,
                        _f.mediums.contains(medium),
                        () => _set(
                          _f.copyWith(mediums: _toggled(_f.mediums, medium)),
                        ),
                      ),
                  ]),
                if (facets.sizes.isNotEmpty)
                  group('Size', [
                    for (final size in ArtworkSizeBand.values)
                      if (facets.sizes[size] != null)
                        chip(
                          artworkSizeBandLabel[size]!,
                          facets.sizes[size]!,
                          _f.size == size,
                          () => _set(
                            _f.copyWith(size: _f.size == size ? null : size),
                          ),
                        ),
                  ]),
                if (facets.ranks.isNotEmpty)
                  group('Rank', [
                    for (final rank in ArtworkRarity.values)
                      if (facets.ranks[rank] != null)
                        chip(
                          artworkRarityLabel[rank]!,
                          facets.ranks[rank]!,
                          _f.ranks.contains(rank),
                          () => _set(
                            _f.copyWith(ranks: _toggled(_f.ranks, rank)),
                          ),
                        ),
                  ]),
                if (facets.verified > 0 || facets.exclusive > 0)
                  group('Artist and edition', [
                    if (facets.verified > 0)
                      chip(
                        'Verified artists only',
                        facets.verified,
                        _f.verifiedOnly,
                        () => _set(_f.copyWith(verifiedOnly: !_f.verifiedOnly)),
                      ),
                    if (facets.exclusive > 0)
                      chip(
                        'Exclusive to GalleryZone',
                        facets.exclusive,
                        _f.exclusiveOnly,
                        () =>
                            _set(_f.copyWith(exclusiveOnly: !_f.exclusiveOnly)),
                      ),
                  ]),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    matching == 1
                        ? 'Show 1 artwork'
                        : 'Show $matching artworks',
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
