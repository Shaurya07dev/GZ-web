import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../../core/launch.dart';
import '../../../core/motion.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/artist.dart';
import '../../../data/models/artwork.dart';
import '../../auth/providers/auth_providers.dart' show authErrorMessage;
import '../providers/marketplace_providers.dart';
import '../widgets/artwork_card.dart';
import '../widgets/social_glyphs.dart';

/// Port of `app/marketplace/[artworkId]/page.tsx` — gallery, info panel and
/// the "more from this artist" rail, stacked instead of the web's two-column
/// split. The artist's *real* verification state is looked up (not
/// synthesized from `artwork.verifiedArtist`) so the Gold ✦ tier can show
/// where it applies.
class ArtworkDetailScreen extends ConsumerWidget {
  const ArtworkDetailScreen({super.key, required this.artworkId, this.preview});

  static const path = '/marketplace/:artworkId';

  final String artworkId;

  /// The card's copy of the piece, when the page is opened from a grid. It is
  /// drawn straight away — the photo flies into place and the page reads as
  /// instant — while the fresh copy loads behind it.
  final Artwork? preview;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final artwork = ref.watch(artworkProvider(artworkId));
    final shown = artwork.hasValue ? artwork.value : preview;
    final ready = shown != null && !artwork.hasError;

    return _DetailScaffold(
      title: ready ? shown.title : null,
      bottomBar: ready ? _BuyBar(artwork: shown) : null,
      body: ready
          ? _ArtworkDetailBody(artwork: shown)
          : artwork.when(
              loading: () => const _DetailSkeleton(),
              error: (error, stack) => EmptyState(
                icon: LucideIcons.triangleAlert,
                title: "Couldn't load this artwork",
                description: authErrorMessage(error),
                action: OutlinedButton(
                  onPressed: () => ref.invalidate(artworkProvider(artworkId)),
                  child: const Text('Try again'),
                ),
              ),
              data: (data) {
                if (data == null) {
                  return const EmptyState(
                    icon: LucideIcons.searchX,
                    title: 'Artwork not found',
                    description: 'This listing may have been removed.',
                  );
                }
                return _ArtworkDetailBody(artwork: data);
              },
            ),
    );
  }
}

/// The page's frame. Its app bar says "Artwork" until the reader scrolls past
/// the piece's own heading, then names the piece — the title comes along with
/// them instead of leaving the screen.
class _DetailScaffold extends StatefulWidget {
  const _DetailScaffold({
    required this.title,
    required this.body,
    this.bottomBar,
  });

  /// Null while there is no piece to name yet.
  final String? title;
  final Widget body;
  final Widget? bottomBar;

  @override
  State<_DetailScaffold> createState() => _DetailScaffoldState();
}

class _DetailScaffoldState extends State<_DetailScaffold> {
  final _pastHeading = ValueNotifier(false);

  @override
  void dispose() {
    _pastHeading.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollNotification notification) {
    if (notification.depth == 0 && notification.metrics.axis == Axis.vertical) {
      // The heading sits under the 4:5 photo; it has gone once the scroll
      // clears the photo and the heading's few lines.
      final photo = math.min(MediaQuery.sizeOf(context).width, 760.0) - 32;
      _pastHeading.value = notification.metrics.pixels > photo * 1.25 + 110;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.title;
    return Scaffold(
      appBar: AppBar(
        title: title == null
            ? const Text('Artwork')
            : ValueListenableBuilder<bool>(
                valueListenable: _pastHeading,
                builder: (context, past, _) => AnimatedSwitcher(
                  duration: AppMotion.medium,
                  layoutBuilder: (current, previous) => Stack(
                    alignment: Alignment.centerLeft,
                    children: [...previous, ?current],
                  ),
                  child: Text(
                    past ? title : 'Artwork',
                    key: ValueKey(past),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
      ),
      bottomNavigationBar: widget.bottomBar,
      body: NotificationListener<ScrollNotification>(
        onNotification: _onScroll,
        child: widget.body,
      ),
    );
  }
}

/// The page's own shape while a deep link loads: the photo's frame, then the
/// lines of its label.
class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading artwork',
      child: ExcludeSemantics(
        child: Shimmer(
          child: SingleChildScrollView(
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: ContentWidth(
              maxWidth: 728,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  AspectRatio(
                    aspectRatio: 4 / 5,
                    child: SkeletonBlock(radius: AppRadius.lg),
                  ),
                  SizedBox(height: 24),
                  SkeletonBlock(width: 90, height: 11),
                  SizedBox(height: 12),
                  SkeletonBlock(width: 260, height: 30),
                  SizedBox(height: 12),
                  SkeletonBlock(width: 140, height: 14),
                  SizedBox(height: 24),
                  SkeletonBlock(width: 120, height: 26),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ArtworkDetailBody extends ConsumerWidget {
  const _ArtworkDetailBody({required this.artwork});

  final Artwork artwork;

  static const _noVerification = ArtistVerificationState(
    tier1SocialMedia: false,
    tier2ActivePlan: false,
    tier3FirstSale: false,
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final artist = ref.watch(artistProfileProvider(artwork.artistId)).value;
    final siblings =
        ref.watch(artworksByArtistProvider(artwork.artistId)).value ?? [];
    final related = siblings.where((a) => a.id != artwork.id).take(4).toList();

    // One stacked column, capped: gallery + description + spec rows stretched
    // across a desktop window is unreadable, and a second wide-only layout
    // would be a whole duplicate screen to keep in sync.
    return ContentWidth(
      maxWidth: 760,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          _Gallery(
            images: artwork.images,
            fallbackUrl: artwork.thumbnailUrl,
            heroTag: artworkHeroTag(artwork.id),
          ),
          const SizedBox(height: 24),
          // The photo is what flew in; the words settle in under it a beat
          // later rather than racing it.
          Reveal(
            index: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  humanize(artwork.category).toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.tertiary,
                    letterSpacing: 1.6,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  artwork.title,
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Flexible(
                      child: InkWell(
                        onTap: () =>
                            context.push('/artists/${artwork.artistId}'),
                        child: Text(
                          artwork.artistName,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w500,
                            color: theme.colorScheme.tertiary,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    VerifiedBadge(
                      verification: artist?.verification ?? _noVerification,
                      small: true,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        PriceTag(
                          amount: artwork.customerPrice,
                          style: theme.textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 2),
                        Text('incl. GST', style: theme.textTheme.labelSmall),
                      ],
                    ),
                    const Spacer(),
                  ],
                ),
                if (artwork.verifiedArtist) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.badgeCheck,
                        size: 14,
                        color: theme.colorScheme.tertiary,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Sold by a verified GalleryZone artist.',
                          style: theme.textTheme.labelSmall,
                        ),
                      ),
                    ],
                  ),
                ],
                if (artwork.exclusive) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.sparkles,
                        size: 14,
                        color: theme.colorScheme.tertiary,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Exclusive to GalleryZone',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.tertiary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 20),
                const Divider(),
                _SpecGrid(artwork: artwork),
                const Divider(),
                const SizedBox(height: 16),
                Text(
                  artwork.description,
                  style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
                ),
                const SizedBox(height: 16),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => context.push('/verify/${artwork.id}'),
                    icon: const Icon(LucideIcons.scrollText, size: 14),
                    label: const Text("View this artwork's digital passport"),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      foregroundColor: theme.colorScheme.tertiary,
                      textStyle: theme.textTheme.labelLarge,
                    ),
                  ),
                ),
                if (artwork.socialProofLinks.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(
                    'Process & provenance',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final link in artwork.socialProofLinks)
                        ActionChip(
                          avatar: SocialGlyph(
                            platform: link.platform,
                            size: 14,
                          ),
                          label: Text(SocialGlyph.label(link.platform)),
                          onPressed: () => openExternal(context, link.url),
                        ),
                    ],
                  ),
                ],
                if (related.isNotEmpty) ...[
                  const SizedBox(height: 32),
                  const Divider(),
                  const SizedBox(height: 16),
                  Text(
                    'More from ${artwork.artistName}',
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height:
                        200 * 1.25 +
                        ArtworkGridDelegate.textHeight *
                            ArtworkGridDelegate.textScaleOf(context),
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: related.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(width: 16),
                      itemBuilder: (context, index) =>
                          ArtworkCard(artwork: related[index], width: 200),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Buying, pinned to the foot of the page: in reach from the first photo to
/// the last line of the description, beside the heart that saves it for later.
class _BuyBar extends ConsumerWidget {
  const _BuyBar({required this.artwork});

  final Artwork artwork;

  static String _buyLabel(ArtworkStatus status) => switch (status) {
    ArtworkStatus.marketplace => 'Buy Now',
    ArtworkStatus.reserved => 'Reserved',
    ArtworkStatus.sold => 'Sold',
    _ => 'No longer available',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final isWishlisted = ref.watch(wishlistProvider).contains(artwork.id);
    final isAvailable = artwork.status == ArtworkStatus.marketplace;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(
          top: BorderSide(color: theme.colorScheme.outlineVariant),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 728),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 52,
                      child: FilledButton(
                        onPressed: isAvailable
                            ? () {
                                HapticFeedback.lightImpact();
                                context.push(
                                  '/checkout?artworkId=${artwork.id}',
                                );
                              }
                            : null,
                        child: Text(_buyLabel(artwork.status)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    height: 52,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        ref.read(wishlistProvider.notifier).toggle(artwork.id);
                      },
                      icon: WishlistHeart(saved: isWishlisted),
                      label: Text(isWishlisted ? 'Wishlisted' : 'Wishlist'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Hero image + thumbnail strip, with tap-to-expand into a full-screen
/// viewer (the web's zoom dialog).
class _Gallery extends StatefulWidget {
  const _Gallery({
    required this.images,
    required this.fallbackUrl,
    required this.heroTag,
  });

  final List<ArtworkImage> images;
  final String fallbackUrl;

  /// Shared with the marketplace card the page was opened from, and with the
  /// full-size viewer: the photo travels between all three.
  final Object heroTag;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  int _activeIndex = 0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sorted = [...widget.images]
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    final activeUrl = sorted.isEmpty
        ? widget.fallbackUrl
        : sorted[_activeIndex].url;

    return Column(
      children: [
        GestureDetector(
          onTap: activeUrl.isEmpty
              ? null
              : () =>
                    Navigator.of(context)
                        .push(_FullSizeViewer.route(activeUrl, widget.heroTag)),
          child: AspectRatio(
            aspectRatio: 4 / 5,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Hero(
                  tag: widget.heroTag,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    // A thumbnail tap cross-fades the photo instead of
                    // swapping it in a single frame.
                    child: AnimatedSwitcher(
                      duration: motionOf(context)
                          ? AppMotion.medium
                          : Duration.zero,
                      layoutBuilder: (current, previous) => Stack(
                        fit: StackFit.expand,
                        children: [...previous, ?current],
                      ),
                      child: ArtworkImageView(
                        key: ValueKey(activeUrl),
                        url: activeUrl,
                      ),
                    ),
                  ),
                ),
                if (activeUrl.isNotEmpty)
                  Positioned(
                    right: 12,
                    bottom: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surface.withValues(
                          alpha: 0.85,
                        ),
                        borderRadius: BorderRadius.circular(AppRadius.xl4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(LucideIcons.expand, size: 12),
                          const SizedBox(width: 6),
                          Text(
                            'View full size',
                            style: theme.textTheme.labelSmall,
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (sorted.length > 1) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 68,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: sorted.length,
              separatorBuilder: (context, index) => const SizedBox(width: 10),
              itemBuilder: (context, index) => GestureDetector(
                onTap: () {
                  if (index == _activeIndex) return;
                  HapticFeedback.selectionClick();
                  setState(() => _activeIndex = index);
                },
                child: AnimatedContainer(
                  duration: AppMotion.fast,
                  width: 68,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(
                      color: index == _activeIndex
                          ? theme.colorScheme.tertiary
                          : theme.colorScheme.outline,
                      width: index == _activeIndex ? 2 : 1,
                    ),
                  ),
                  child: ArtworkImageView(url: sorted[index].thumbnailUrl),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// The photo at full size on black, pinch to zoom and drag to look closer —
/// the brushwork is the point of looking at a painting on a phone. The photo
/// flies here from the gallery and back.
class _FullSizeViewer extends StatefulWidget {
  const _FullSizeViewer({required this.url, required this.heroTag});

  final String url;
  final Object heroTag;

  static Route<void> route(String url, Object heroTag) =>
      PageRouteBuilder<void>(
        // The black comes from the page itself rather than a barrier, so it
        // can thin out while the photo is dragged away.
        opaque: false,
        transitionDuration: AppMotion.slow,
        reverseTransitionDuration: AppMotion.medium,
        pageBuilder: (context, animation, secondaryAnimation) =>
            _FullSizeViewer(url: url, heroTag: heroTag),
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeTransition(opacity: animation, child: child),
      );

  @override
  State<_FullSizeViewer> createState() => _FullSizeViewerState();
}

/// Drag the photo down (or up) to put it away, as in the phone's own photo
/// viewer: the black thins as it goes, and letting go far enough — or fast
/// enough — sends it back into the page. One finger only and only while not
/// zoomed in, so it never fights a pinch or panning around a detail. The drag
/// is read from the viewer's own gesture, not a second recognizer competing
/// with it.
class _FullSizeViewerState extends State<_FullSizeViewer>
    with SingleTickerProviderStateMixin {
  final _zoom = TransformationController();
  late final AnimationController _settle =
      AnimationController(vsync: this, duration: AppMotion.medium)..addListener(
        () => setState(() => _drag = _settleFrom * (1 - _settleCurve.value)),
      );
  late final Animation<double> _settleCurve = CurvedAnimation(
    parent: _settle,
    curve: AppMotion.standard,
  );
  bool _zoomed = false;
  double _drag = 0;
  double _settleFrom = 0;

  @override
  void initState() {
    super.initState();
    _zoom.addListener(() {
      final zoomed = _zoom.value.getMaxScaleOnAxis() > 1.01;
      if (zoomed != _zoomed) setState(() => _zoomed = zoomed);
    });
  }

  @override
  void dispose() {
    _zoom.dispose();
    _settle.dispose();
    super.dispose();
  }

  void _onUpdate(ScaleUpdateDetails details) {
    if (_zoomed || details.pointerCount != 1) return;
    _settle.stop();
    setState(() => _drag += details.focalPointDelta.dy);
  }

  void _onEnd(ScaleEndDetails details) {
    if (_drag == 0) return;
    if (_drag.abs() > 120 || details.velocity.pixelsPerSecond.dy.abs() > 900) {
      HapticFeedback.lightImpact();
      Navigator.of(context).pop();
      return;
    }
    _settleFrom = _drag;
    _settle.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final shown = (1 - _drag.abs() / 400).clamp(0.0, 1.0);
    return Scaffold(
      backgroundColor: Colors.black.withValues(alpha: shown),
      body: Stack(
        children: [
          Positioned.fill(
            child: Transform.translate(
              offset: Offset(0, _drag),
              child: Transform.scale(
                scale: 1 - (1 - shown) * 0.2,
                child: InteractiveViewer(
                  transformationController: _zoom,
                  maxScale: 5,
                  panEnabled: _zoomed,
                  onInteractionUpdate: _onUpdate,
                  onInteractionEnd: _onEnd,
                  child: Center(
                    child: Hero(
                      tag: widget.heroTag,
                      child: ArtworkImageView(
                        url: widget.url,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Positioned, so the Stack takes the whole screen rather than the
          // size of this button.
          Positioned(
            top: 0,
            left: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Opacity(
                  opacity: shown,
                  child: IconButton(
                    tooltip: 'Close',
                    icon: const Icon(Icons.close, color: Colors.white),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.12),
                    ),
                    onPressed: () => Navigator.of(context).pop(),
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

class _SpecGrid extends StatelessWidget {
  const _SpecGrid({required this.artwork});

  final Artwork artwork;

  @override
  Widget build(BuildContext context) {
    final dimensions = dimensionsLabel(artwork.dimensions);
    final specs = {
      'Category': humanize(artwork.category),
      if (artwork.artworkType != null && artwork.artworkType!.trim().isNotEmpty)
        'Art form': artwork.artworkType!.trim(),
      'Medium': humanize(artwork.medium),
      'Dimensions': dimensions.isEmpty ? 'Not specified' : dimensions,
      'Year': artwork.yearCreated?.toString() ?? 'Not specified',
    };
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          for (final entry in specs.entries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 110,
                    child: Text(entry.key, style: theme.textTheme.bodySmall),
                  ),
                  Expanded(
                    child: Text(
                      entry.value,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
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
