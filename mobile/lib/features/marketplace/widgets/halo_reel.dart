import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/artwork.dart';
import 'artwork_card.dart';

/// One painting on the reel: a listing, which opens its page, or one of the
/// brand paintings that pad the ring when few listings have photos.
class HaloReelItem {
  const HaloReelItem({required this.imageUrl, this.artwork});

  final String imageUrl;
  final Artwork? artwork;
}

/// The website's own fallback reel (`marketplace-hero.tsx`), as bundled here.
const _fallbackPaintings = [
  '/artworks/landscape.jpg',
  '/artworks/portrait-woman.jpg',
  '/artworks/bird.jpg',
  '/artworks/draped-figure.jpg',
  '/artworks/collage-busts.jpg',
  '/artworks/eye-pyramid.jpg',
  '/artworks/framed-painting.jpg',
];

/// [count] distinct paintings for the reel: photographed listings first, then
/// brand paintings until the ring is full. A photo two listings share rides
/// once.
List<HaloReelItem> haloReelItems(List<Artwork> artworks, {int count = 6}) {
  String image(String url) => url.replaceAll(RegExp(r'\.\w+$'), '');
  final seen = <String>{};
  final items = <HaloReelItem>[];
  for (final artwork in artworks) {
    if (items.length == count) return items;
    final url = artwork.thumbnailUrl;
    if (url.isEmpty || !seen.add(image(url))) continue;
    items.add(HaloReelItem(imageUrl: url, artwork: artwork));
  }
  for (final url in _fallbackPaintings) {
    if (items.length == count) break;
    if (seen.add(image(url))) items.add(HaloReelItem(imageUrl: url));
  }
  return items;
}

/// Port of the website's halo reel (`components/ui/halo-reel.tsx`), shaped
/// for a phone: the paintings ride a flat ellipse, the front one large and
/// bright, the far side small and dimmed. It turns one painting forward every
/// few seconds, spins under a drag and settles on the nearest painting, and
/// the painting at the front opens its page. Tapping one at the side brings
/// it round instead.
///
/// One unbounded controller holds the ring's turn, in paintings; every card's
/// place, size and shade derive from it, so a spin repaints and never relays
/// out.
class HaloReel extends StatefulWidget {
  const HaloReel({super.key, required this.items, this.height = 168});

  final List<HaloReelItem> items;
  final double height;

  @override
  State<HaloReel> createState() => _HaloReelState();
}

class _HaloReelState extends State<HaloReel>
    with SingleTickerProviderStateMixin {
  late final AnimationController _turn = AnimationController.unbounded(
    vsync: this,
  );
  Timer? _autoplay;

  /// How long a painting holds the front, and how long one step takes.
  static const _hold = Duration(milliseconds: 2600);
  static const _step = Duration(milliseconds: 950);

  int get _count => widget.items.length;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _scheduleStep();
  }

  @override
  void dispose() {
    _autoplay?.cancel();
    _turn.dispose();
    super.dispose();
  }

  void _scheduleStep([Duration hold = _hold]) {
    _autoplay?.cancel();
    if (_count < 2 || !motionOf(context)) return;
    _autoplay = Timer(hold, () {
      if (!mounted) return;
      _turn
          .animateTo(
            _turn.value.roundToDouble() + 1,
            duration: _step,
            curve: Curves.easeInOutCubic,
          )
          .whenComplete(() {
            if (mounted) _scheduleStep();
          });
    });
  }

  /// Settles the ring on [target] (in paintings), then resumes the autoplay
  /// after a longer rest — someone just touched it.
  void _settleOn(double target) {
    _turn
        .animateTo(target, duration: AppMotion.slow, curve: AppMotion.enter)
        .whenComplete(() {
          if (mounted) _scheduleStep(const Duration(seconds: 5));
        });
  }

  void _onTapCard(int index) {
    final item = widget.items[index];
    // How far, the short way round, card [index] is from the front.
    var delta = (index - _turn.value) % _count;
    if (delta > _count / 2) delta -= _count;
    if (delta.abs() < 0.5) {
      final artwork = item.artwork;
      if (artwork == null) return;
      HapticFeedback.lightImpact();
      context.push('/marketplace/${artwork.id}', extra: artwork);
      return;
    }
    _autoplay?.cancel();
    HapticFeedback.selectionClick();
    _settleOn((_turn.value + delta).roundToDouble());
  }

  @override
  Widget build(BuildContext context) {
    if (_count == 0) return SizedBox(height: widget.height);
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: widget.height,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final cardH = widget.height * 0.8;
          final cardW = cardH * 0.76;
          final radiusX = width * 0.34;
          final radiusY = widget.height * 0.13;
          final centreY = widget.height / 2 - 4;
          // A drag of one painting's share of the ring's front edge turns it
          // by one painting.
          final slotWidth = 2 * math.pi * radiusX / _count;

          return Semantics(
            label: 'Featured artworks',
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onHorizontalDragStart: (_) {
                _autoplay?.cancel();
                _turn.stop();
              },
              onHorizontalDragUpdate: (details) =>
                  _turn.value -= details.delta.dx / slotWidth,
              onHorizontalDragEnd: (details) {
                final fling =
                    -details.velocity.pixelsPerSecond.dx / slotWidth * 0.18;
                HapticFeedback.selectionClick();
                _settleOn((_turn.value + fling).roundToDouble());
              },
              child: AnimatedBuilder(
                animation: _turn,
                builder: (context, _) {
                  final cards = [
                    for (var i = 0; i < _count; i++)
                      _place(i, 2 * math.pi * (i - _turn.value) / _count),
                  ]..sort((a, b) => a.depth.compareTo(b.depth));
                  return Stack(
                    clipBehavior: Clip.none,
                    children: [
                      for (final card in cards)
                        Positioned(
                          left: width / 2 - cardW / 2,
                          top: centreY - cardH / 2,
                          width: cardW,
                          height: cardH,
                          child: Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.translationValues(
                              radiusX * card.x,
                              radiusY * card.y,
                              0,
                            )..scaleByDouble(card.scale, card.scale, 1, 1),
                            child: GestureDetector(
                              onTap: () => _onTapCard(card.index),
                              child: _ReelCard(
                                item: widget.items[card.index],
                                depth: card.depth,
                                scrim: scheme.surface,
                                shadow: scheme.shadow,
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }

  /// Where card [index] sits at angle [angle] round the ring (0 is the front):
  /// across by sin, down by cos — the front rides lowest — and sized and lit
  /// by how near the front it is.
  static _Placed _place(int index, double angle) {
    final depth = (1 + math.cos(angle)) / 2;
    return _Placed(
      index: index,
      x: math.sin(angle),
      y: math.cos(angle),
      depth: depth,
      scale: 0.5 + 0.5 * depth,
    );
  }
}

class _Placed {
  const _Placed({
    required this.index,
    required this.x,
    required this.y,
    required this.depth,
    required this.scale,
  });

  final int index;
  final double x;
  final double y;
  final double depth;
  final double scale;
}

class _ReelCard extends StatelessWidget {
  const _ReelCard({
    required this.item,
    required this.depth,
    required this.scrim,
    required this.shadow,
  });

  final HaloReelItem item;

  /// 1 at the front of the ring, 0 at the back.
  final double depth;
  final Color scrim;
  final Color shadow;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadius.md);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: shadow.withValues(alpha: 0.32 * depth * depth),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ArtworkImageView(url: item.imageUrl),
            // The far side recedes into the page rather than fading out —
            // a wash of the page colour, cheaper than an opacity layer.
            ColoredBox(color: scrim.withValues(alpha: 0.62 * (1 - depth))),
          ],
        ),
      ),
    );
  }
}
