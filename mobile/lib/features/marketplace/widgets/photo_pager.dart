import 'package:flutter/material.dart';

import '../../../core/motion.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/artwork.dart';
import 'artwork_card.dart' show ArtworkImageView;

/// Every photo of a piece, cover first, as the card and the lists need them:
/// the small version when there is one. A piece with no photo list yet gets its
/// cover alone.
List<String> photoUrlsOf(Artwork artwork) {
  final sorted = [...artwork.images]
    ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  final urls = [
    for (final image in sorted)
      if (image.thumbnailUrl.isNotEmpty) image.thumbnailUrl else image.url,
  ].where((url) => url.isNotEmpty).toList();
  return urls.isEmpty ? [artwork.thumbnailUrl] : urls;
}

/// A piece's photos you can swipe through (client, 18 Nov 2026: buyers and
/// aggregators should see every angle without opening the piece). A tap still
/// goes to whatever the card around it does; only a sideways drag moves between
/// photos, and the dots say where you are. With one photo it is just the photo.
///
/// [swipeable] is off inside a sideways rail of cards, where a drag on the photo
/// has to scroll the rail instead.
class PhotoPager extends StatefulWidget {
  const PhotoPager({
    super.key,
    required this.urls,
    this.controller,
    this.onPageChanged,
    this.swipeable = true,
    this.fit = BoxFit.cover,
  });

  final List<String> urls;
  final PageController? controller;
  final ValueChanged<int>? onPageChanged;
  final bool swipeable;
  final BoxFit fit;

  @override
  State<PhotoPager> createState() => _PhotoPagerState();
}

class _PhotoPagerState extends State<PhotoPager> {
  PageController? _own;
  int _index = 0;

  PageController get _controller =>
      widget.controller ?? (_own ??= PageController());

  @override
  void dispose() {
    _own?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.urls;
    if (urls.length < 2 || !widget.swipeable) {
      return ArtworkImageView(
        url: urls.isEmpty ? '' : urls.first,
        fit: widget.fit,
      );
    }
    final theme = Theme.of(context);
    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          controller: _controller,
          itemCount: urls.length,
          onPageChanged: (i) {
            setState(() => _index = i);
            widget.onPageChanged?.call(i);
          },
          itemBuilder: (context, i) => Semantics(
            label: 'Photo ${i + 1} of ${urls.length}',
            image: true,
            child: ArtworkImageView(url: urls[i], fit: widget.fit),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 8,
          child: IgnorePointer(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < urls.length; i++)
                  AnimatedContainer(
                    duration: motionOf(context)
                        ? AppMotion.fast
                        : Duration.zero,
                    margin: const EdgeInsets.symmetric(horizontal: 2.5),
                    width: i == _index ? 14 : 5,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(
                        alpha: i == _index ? 0.95 : 0.6,
                      ),
                      borderRadius: BorderRadius.circular(3),
                      boxShadow: [
                        BoxShadow(
                          color: theme.shadowColor.withValues(alpha: 0.35),
                          blurRadius: 3,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
