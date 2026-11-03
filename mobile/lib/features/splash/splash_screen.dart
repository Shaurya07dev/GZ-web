import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/motion.dart';
import '../../core/theme/app_theme.dart';
import '../../data/models/auth.dart';
import '../auth/providers/auth_providers.dart';
import '../auth/role_options.dart';
import '../auth/screens/login_screen.dart';

/// The opening, start to finish: from a first frame identical to the native
/// splash to the app's own page. Nothing to tap and nothing to wait on; it
/// plays once and the app opens.
const splashDuration = Duration(milliseconds: 2000);

/// With animations turned off on the device, the mark holds just long enough
/// to register and the app opens without the light.
const splashStillHold = Duration(milliseconds: 600);

/// The app icon's gold GZ, framed the way Android 12+ draws its splash icon:
/// a 288-point box. Every launch path draws the GZ at the same size (see
/// assets/icon/generate_icons.py), so drawing this image in this box puts the
/// mark exactly where the native splash left it.
const splashMarkAsset = 'assets/icon/splash_android12.png';
const _markBox = 288.0;

/// Where a launch ends up once the opening is done.
String splashDestination(Role? role) => role?.home ?? LoginScreen.path;

/// Decodes the mark before the first frame, while the native splash is still
/// up, so the first Flutter frame already has it: the native splash comes down
/// on that frame, and a mark that arrived a frame late would blink. Never holds
/// the launch up for long, and never fails it.
Future<void> warmSplashMark() {
  final done = Completer<void>();
  final stream = const AssetImage(splashMarkAsset).resolve(ImageConfiguration.empty);
  late final ImageStreamListener listener;
  void finish() {
    if (!done.isCompleted) done.complete();
    stream.removeListener(listener);
  }

  listener = ImageStreamListener((_, _) => finish(), onError: (_, _) => finish());
  stream.addListener(listener);
  return done.future.timeout(const Duration(milliseconds: 600), onTimeout: () {});
}

/// The launch screen. It is the router's initial location, so it runs on every
/// cold start and never sits in the back stack (`go` replaces it).
///
/// The opening, in one breath: the app icon's black and gold GZ, exactly as the
/// system left them. A band of light crosses the gilt. GALLERYZONE writes in
/// underneath and a hairline draws under it. Then the light comes up from
/// behind the mark and opens out to the edges, warm, like a gallery's lights
/// coming on, and the app is there on the same paper colour, so nothing flashes.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  static const path = '/';

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _opening =
      AnimationController(vsync: this, duration: splashDuration)
        ..addStatusListener((status) {
          if (status == AnimationStatus.completed) _leave();
        });
  Timer? _still;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (motionOf(context)) {
      _opening.forward();
    } else {
      _still = Timer(splashStillHold, _leave);
    }
  }

  @override
  void dispose() {
    _still?.cancel();
    _opening.dispose();
    super.dispose();
  }

  void _leave() {
    if (!mounted) return;
    context.go(splashDestination(ref.read(sessionProvider)));
  }

  Animation<double> _phase(double begin, double end, Curve curve) =>
      CurvedAnimation(
        parent: _opening,
        curve: Interval(begin, end, curve: curve),
      );

  late final _glint = _phase(0.06, 0.5, Curves.easeInOutCubic);
  late final _word = _phase(0.22, 0.58, AppMotion.enter);
  late final _rule = _phase(0.42, 0.66, AppMotion.enter);
  late final _light = _phase(0.62, 0.97, Curves.easeInOutCubic);
  late final _wordAway = _phase(0.6, 0.7, Curves.easeOut);
  late final _markAway = _phase(0.84, 1, Curves.easeOut);

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _light,
      // Light status-bar icons on the black, dark ones once the light is up.
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: _light.value < 0.5
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        child: child!,
      ),
      child: Scaffold(
        backgroundColor: AppColors.darkBackground,
        body: CustomPaint(
          painter: _LightPainter(_light),
          // The mark is centred on the whole window, as the native splash
          // draws it.
          child: SizedBox.expand(
            child: Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                _Vanish(
                  away: _markAway,
                  rise: 0.03,
                  child: _Glint(
                    sweep: _glint,
                    child: Image.asset(
                      splashMarkAsset,
                      width: _markBox,
                      height: _markBox,
                      filterQuality: FilterQuality.high,
                      gaplessPlayback: true,
                      excludeFromSemantics: true,
                    ),
                  ),
                ),
                Transform.translate(
                  offset: const Offset(0, 54),
                  child: _Vanish(
                    away: _wordAway,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _Wordmark(reveal: _word),
                        const SizedBox(height: 12),
                        AnimatedBuilder(
                          animation: _rule,
                          builder: (context, _) => Container(
                            width: 40 * _rule.value,
                            height: 1,
                            color: AppColors.darkGold.withValues(alpha: 0.7),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The light: the app's paper colour opening out from behind the mark to the
/// edges of the screen, with a soft warm edge rather than a hard disc.
class _LightPainter extends CustomPainter {
  _LightPainter(this.progress) : super(repaint: progress);

  final Animation<double> progress;

  static const _paper = AppColors.lightBackground;

  @override
  void paint(Canvas canvas, Size size) {
    final p = progress.value;
    if (p <= 0) return;
    if (p >= 1) {
      canvas.drawRect(Offset.zero & size, Paint()..color = _paper);
      return;
    }
    final center = size.center(Offset.zero);
    // Far enough that the solid part has covered the corners when p reaches 1.
    final reach = size.longestSide * 0.62 / 0.84;
    // The light switches on behind the whole mark (a disc already wider than
    // the GZ, fading up) and then opens out. Starting from a point would show
    // as a bright dot through the gaps in the letters.
    const start = 72.0;
    final radius = start + (reach - start) * p;
    // It warms up the way a lamp does: amber first, then the paper's white.
    // A paper colour simply faded in over black would pass through flat grey.
    final on = (p / 0.16).clamp(0.0, 1.0);
    final light = Color.lerp(AppColors.darkGoldDeep, _paper, on)!.withValues(alpha: on);
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = RadialGradient(
          colors: [
            light,
            light,
            AppColors.darkGoldBright.withValues(alpha: 0.16 * on),
            AppColors.darkGoldBright.withValues(alpha: 0),
          ],
          stops: const [0, 0.84, 0.93, 1],
        ).createShader(Rect.fromCircle(center: center, radius: radius)),
    );
  }

  @override
  bool shouldRepaint(_LightPainter oldDelegate) => false;
}

/// Fades its child out as [away] runs, rising very slightly as it goes.
class _Vanish extends StatelessWidget {
  const _Vanish({required this.away, required this.child, this.rise = 0});

  final Animation<double> away;
  final double rise;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: away,
      builder: (context, child) => Opacity(
        opacity: 1 - away.value,
        child: Transform.scale(scale: 1 + rise * away.value, child: child),
      ),
      child: child,
    );
  }
}

/// One band of light passing across the mark, the way it would across gilt.
class _Glint extends StatelessWidget {
  const _Glint({required this.sweep, required this.child});

  final Animation<double> sweep;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: sweep,
      builder: (context, child) {
        final progress = sweep.value;
        if (progress == 0 || progress == 1) return child!;
        final t = progress * 1.6 - 0.3;
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white.withValues(alpha: 0),
              Colors.white.withValues(alpha: 0.6),
              Colors.white.withValues(alpha: 0),
            ],
            stops: [
              (t - 0.1).clamp(0.0, 1.0),
              t.clamp(0.0, 1.0),
              (t + 0.1).clamp(0.0, 1.0),
            ],
          ).createShader(bounds),
          child: child,
        );
      },
      child: child,
    );
  }
}

/// "GALLERYZONE", written in from left to right under a soft edge while its
/// letters close from wide to their resting spacing.
class _Wordmark extends StatelessWidget {
  const _Wordmark({required this.reveal});

  final Animation<double> reveal;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.labelLarge?.copyWith(
      fontFamily: AppTheme.sansFamily,
      fontWeight: FontWeight.w500,
      fontSize: 12.5,
      color: AppColors.darkForeground.withValues(alpha: 0.86),
    );
    return AnimatedBuilder(
      animation: reveal,
      builder: (context, _) {
        final t = reveal.value;
        final word = Text(
          'GALLERYZONE',
          style: style?.copyWith(letterSpacing: 5 + (1 - t) * 4),
        );
        if (t == 1) return word;
        final edge = t * 1.3 - 0.15;
        return ShaderMask(
          blendMode: BlendMode.dstIn,
          shaderCallback: (bounds) => LinearGradient(
            colors: const [Colors.white, Color(0x00FFFFFF)],
            stops: [edge.clamp(0.0, 1.0), (edge + 0.15).clamp(0.0, 1.0)],
          ).createShader(bounds),
          child: word,
        );
      },
    );
  }
}
