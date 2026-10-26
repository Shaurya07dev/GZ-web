import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart' show NumberFormat;

import 'theme/app_theme.dart';

/// Whether this screen should move at all. Honours the system's "remove
/// animations" setting, which every widget below falls back to a still frame
/// for.
bool motionOf(BuildContext context) => !MediaQuery.disableAnimationsOf(context);

/// Content arriving: it fades in while rising a few pixels into place, rather
/// than popping into existence the frame its data lands.
///
/// [index] staggers a list — each item a beat behind the one before, so a page
/// fills top to bottom instead of all at once. Give it a [key] that is stable
/// for the content (an id) and it plays once per visit: scrolling the item out
/// of view and back does not replay it.
class Reveal extends StatefulWidget {
  const Reveal({super.key, required this.child, this.index = 0});

  final Widget child;
  final int index;

  /// Beyond this many items the stagger stops growing — the eighth card of a
  /// grid should not wait on the seventy-eighth.
  static const maxStagger = 8;
  static const _step = Duration(milliseconds: 50);
  static const _rise = 14.0;

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _progress;
  bool _started = false;

  Object? get _playedId => widget.key == null ? null : ('reveal', widget.key);

  @override
  void initState() {
    super.initState();
    final delay = Reveal._step * widget.index.clamp(0, Reveal.maxStagger);
    final total = delay + AppMotion.slow;
    _controller = AnimationController(vsync: this, duration: total);
    _progress = CurvedAnimation(
      parent: _controller,
      curve: Interval(
        delay.inMicroseconds / total.inMicroseconds,
        1,
        curve: AppMotion.enter,
      ),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final storage = PageStorage.maybeOf(context);
    final played =
        _playedId != null &&
        storage?.readState(context, identifier: _playedId) == true;
    if (played || !motionOf(context)) {
      _controller.value = 1;
      return;
    }
    if (_playedId != null) {
      storage?.writeState(context, true, identifier: _playedId);
    }
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _progress,
      child: AnimatedBuilder(
        animation: _progress,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, (1 - _progress.value) * Reveal._rise),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}

/// A page's sections arriving top to bottom: each of [children] in a [Reveal]
/// one beat behind the last. Spacers, and anything already revealing on its
/// own terms, pass through untouched.
List<Widget> revealInOrder(List<Widget> children) {
  var index = 0;
  return [
    for (final child in children)
      child is SizedBox || child is Reveal
          ? child
          : Reveal(index: index++, child: child),
  ];
}

/// A tile that presses in under the finger: the [InkWell] it wraps reports its
/// highlight, and the whole tile settles to [pressedScale] while held. The
/// highlight only comes on once the touch is clearly a tap, so a scroll that
/// starts on a card never makes it twitch.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.borderRadius,
    this.color,
    this.side,
    this.pressedScale = 0.97,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final BorderRadius? borderRadius;

  /// With a [color] (and a [side] for its ring) the tile is a card of its own:
  /// a [Material] the ripple draws on. Prefer it to an `Ink` decoration, which
  /// paints on the page's material and is not repainted when an ancestor
  /// [Reveal] finishes fading — the card's fill went missing until a scroll.
  final Color? color;
  final BorderSide? side;
  final double pressedScale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final ink = InkWell(
      onTap: widget.onTap,
      onLongPress: widget.onLongPress,
      borderRadius: widget.borderRadius,
      onHighlightChanged: (down) => setState(() => _down = down),
      child: widget.child,
    );
    return PressScale(
      pressed: _down,
      scale: widget.pressedScale,
      child: widget.color == null
          ? ink
          : Material(
              color: widget.color,
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(
                borderRadius: widget.borderRadius ?? BorderRadius.zero,
                side: widget.side ?? BorderSide.none,
              ),
              child: ink,
            ),
    );
  }
}

/// The scale half of [Pressable], for a tile whose [InkWell] sits deeper than
/// the part that should move — a card with buttons laid over its photo
/// presses in as one piece.
class PressScale extends StatelessWidget {
  const PressScale({
    super.key,
    required this.pressed,
    required this.child,
    this.scale = 0.97,
  });

  final bool pressed;
  final double scale;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!motionOf(context)) return child;
    return AnimatedScale(
      scale: pressed ? scale : 1,
      // In quickly, out a little slower: the release is what the eye follows.
      duration: pressed ? AppMotion.fast : AppMotion.medium,
      curve: pressed ? Curves.easeOut : AppMotion.standard,
      child: child,
    );
  }
}

/// A number that counts up to [value] the first time it is shown, and glides
/// to its new value when it changes — a total that moves reads as live.
class CountUp extends StatelessWidget {
  const CountUp({
    super.key,
    required this.value,
    required this.format,
    this.style,
    this.textAlign,
  });

  final double value;
  final String Function(double value) format;
  final TextStyle? style;
  final TextAlign? textAlign;

  @override
  Widget build(BuildContext context) {
    // The real value for screen readers, never a frame of the count.
    return Semantics(
      label: format(value),
      excludeSemantics: true,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value),
        duration: motionOf(context)
            ? const Duration(milliseconds: 900)
            : Duration.zero,
        curve: Curves.easeOutCubic,
        builder: (context, shown, _) => Text(
          // The last frame prints the exact value, whatever rounding the
          // in-between frames did.
          format(shown == value ? value : shown),
          style: style,
          textAlign: textAlign,
        ),
      ),
    );
  }
}

/// [CountUp] for a figure that arrives already written out — "₹1,24,500",
/// "18%", "4.8": the number inside counts up in Indian grouping, the words
/// around it stay put, and the last frame is [text] exactly as given.
class CountUpText extends StatelessWidget {
  const CountUpText(this.text, {super.key, this.style});

  final String text;
  final TextStyle? style;

  static final _number = RegExp(r'\d[\d,]*(\.\d+)?');

  @override
  Widget build(BuildContext context) {
    final match = _number.firstMatch(text);
    final value = double.tryParse(match?.group(0)?.replaceAll(',', '') ?? '');
    if (match == null || value == null) return Text(text, style: style);
    final digits = NumberFormat.decimalPatternDigits(
      locale: 'en_IN',
      decimalDigits: (match.group(1)?.length ?? 1) - 1,
    );
    final grouped = match.group(0)!.contains(',');
    return CountUp(
      value: value,
      style: style,
      format: (shown) => shown == value
          ? text
          : text.replaceRange(
              match.start,
              match.end,
              grouped
                  ? digits.format(shown)
                  : digits.format(shown).replaceAll(',', ''),
            ),
    );
  }
}

/// A slow band of light sweeping across the placeholder blocks it wraps — the
/// page is on its way, and the shape of what is coming is already there.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});

  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (motionOf(context)) {
      if (!_controller.isAnimating) _controller.repeat();
    } else {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = scheme.surfaceContainerHighest;
    final light = Color.alphaBlend(
      scheme.surfaceContainerLowest.withValues(alpha: 0.7),
      base,
    );
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) => LinearGradient(
          colors: [base, light, base],
          stops: const [0.35, 0.5, 0.65],
          begin: const Alignment(-1, -0.3),
          end: const Alignment(1, 0.3),
          transform: _Sweep(_controller.value),
        ).createShader(bounds),
        child: child,
      ),
      child: widget.child,
    );
  }
}

class _Sweep extends GradientTransform {
  const _Sweep(this.t);

  final double t;

  @override
  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(bounds.width * (t * 2.4 - 1.2), 0, 0);
}

/// One placeholder block. Inside a [Shimmer] it takes the sweep.
class SkeletonBlock extends StatelessWidget {
  const SkeletonBlock({
    super.key,
    this.width,
    this.height = 14,
    this.radius = AppRadius.sm,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// A whole page on its way: a heading and a stack of card-shaped blocks under
/// a shimmer, in place of a lone spinner in the middle of an empty screen.
/// Works anywhere a spinner did — it never asks for more height than it is
/// given, and sizes to its blocks where the height is unbounded.
class PageSkeleton extends StatelessWidget {
  const PageSkeleton({super.key, this.rows = 5});

  final int rows;

  @override
  Widget build(BuildContext context) {
    Widget card() => Container(
      height: 84,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
        ),
      ),
      child: const Row(
        children: [
          SkeletonBlock(width: 56, height: 56, radius: AppRadius.md),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FractionallySizedBox(
                  widthFactor: 0.7,
                  child: SkeletonBlock(height: 14),
                ),
                SizedBox(height: 10),
                FractionallySizedBox(
                  widthFactor: 0.45,
                  child: SkeletonBlock(height: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return Semantics(
      label: 'Loading',
      child: ExcludeSemantics(
        child: Shimmer(
          child: SingleChildScrollView(
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonBlock(width: 160, height: 22),
                const SizedBox(height: 10),
                const SkeletonBlock(width: 240, height: 12),
                const SizedBox(height: 24),
                for (var i = 0; i < rows; i++) card(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The moment something important goes through — an order placed, a work
/// sent for review: a gold disc swells in, its tick draws itself, and a ring
/// of light spreads out with a scatter of gold flecks. Plays once, with one
/// firm tap of haptics; a still, finished mark when motion is off.
class SuccessMark extends StatefulWidget {
  const SuccessMark({super.key, this.size = 76});

  /// The disc's diameter. The burst around it takes twice that.
  final double size;

  @override
  State<SuccessMark> createState() => _SuccessMarkState();
}

class _SuccessMarkState extends State<SuccessMark>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (motionOf(context)) {
      _controller.forward();
      HapticFeedback.mediumImpact();
    } else {
      _controller.value = 1;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: SizedBox.square(
          dimension: widget.size * 2,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) => CustomPaint(
              painter: _SuccessPainter(
                t: _controller.value,
                gold: scheme.primary,
                bright: scheme.tertiary,
                tick: scheme.onPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SuccessPainter extends CustomPainter {
  _SuccessPainter({
    required this.t,
    required this.gold,
    required this.bright,
    required this.tick,
  });

  final double t;
  final Color gold;
  final Color bright;
  final Color tick;

  static double _phase(double t, double begin, double end, Curve curve) =>
      curve.transform(((t - begin) / (end - begin)).clamp(0.0, 1.0));

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final r = size.shortestSide / 4;

    // The ring of light: spreads from the disc's edge and fades as it goes.
    final ring = _phase(t, 0.12, 0.7, Curves.easeOutCubic);
    if (ring > 0 && ring < 1) {
      canvas.drawCircle(
        centre,
        r * (1 + ring * 0.9),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = gold.withValues(alpha: 0.4 * (1 - ring)),
      );
    }

    // Flecks of gold thrown outward, slowing and shrinking as they fly.
    final fleck = _phase(t, 0.18, 0.95, Curves.easeOutCubic);
    if (fleck > 0 && fleck < 1) {
      for (var i = 0; i < 12; i++) {
        final angle = i * math.pi / 6 + (i.isEven ? 0.18 : -0.12);
        final reach = r * (1.05 + fleck * (i.isEven ? 0.85 : 0.6));
        canvas.drawCircle(
          centre + Offset(math.cos(angle), math.sin(angle)) * reach,
          (i.isEven ? 3.2 : 2.2) * (1 - fleck),
          Paint()
            ..color = (i % 3 == 0 ? bright : gold).withValues(alpha: 1 - fleck),
        );
      }
    }

    // The disc swells in, a touch past full size and back.
    final disc = _phase(t, 0, 0.38, Curves.easeOutBack);
    if (disc > 0) {
      canvas.drawCircle(
        centre,
        r * disc,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color.lerp(gold, Colors.white, 0.18)!, gold],
          ).createShader(Rect.fromCircle(center: centre, radius: r)),
      );
    }

    // And the tick draws itself across it.
    final stroke = _phase(t, 0.32, 0.68, Curves.easeOutCubic);
    if (stroke > 0) {
      final path = Path()
        ..moveTo(centre.dx - r * 0.38, centre.dy + r * 0.02)
        ..lineTo(centre.dx - r * 0.1, centre.dy + r * 0.3)
        ..lineTo(centre.dx + r * 0.42, centre.dy - r * 0.28);
      final metric = path.computeMetrics().first;
      canvas.drawPath(
        metric.extractPath(0, metric.length * stroke),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = r * 0.13
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = tick,
      );
    }
  }

  @override
  bool shouldRepaint(_SuccessPainter old) => old.t != t;
}

/// A portal shell's tab content, faded up on each tab change instead of
/// cutting hard from one page to the next.
class BranchFade extends StatefulWidget {
  const BranchFade({super.key, required this.index, required this.child});

  /// The selected branch. A change replays the fade.
  final int index;
  final Widget child;

  @override
  State<BranchFade> createState() => _BranchFadeState();
}

class _BranchFadeState extends State<BranchFade>
    with SingleTickerProviderStateMixin {
  // Short: switching tabs is the most frequent motion in the app, and it
  // should never feel like waiting.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
    value: 1,
  );
  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );

  @override
  void didUpdateWidget(BranchFade oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.index != widget.index && motionOf(context)) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _curve,
      child: ScaleTransition(
        scale: Tween(begin: 0.985, end: 1.0).animate(_curve),
        child: widget.child,
      ),
    );
  }
}
