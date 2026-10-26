import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../data/mock/seed/aggregator_seed.dart'
    show currentAggregatorContact;
import '../../data/mock/seed/artist_seed.dart' show currentArtistName;
import '../../data/mock/seed/customer_seed.dart' show seedCustomerProfile;
import '../../core/motion.dart';
import '../../core/theme/app_theme.dart';
import '../../data/models/auth.dart';
import '../auth/providers/auth_providers.dart';
import '../auth/role_options.dart';
import '../auth/screens/login_screen.dart';
import '../shell/brand_mark.dart';
import '../shell/portal_menu.dart' show accountNameProvider;
import 'art_quotes.dart';

/// How long the mark holds before anything else moves: the opening plays out,
/// and the launch quote stays up long enough to be read. A tap moves on.
const splashHold = Duration(milliseconds: 3200);

/// How long the greeting stays up before the app lands on the role's home.
/// Only signed-in launches show it — there is nobody to greet otherwise.
const splashGreetingHold = Duration(milliseconds: 1600);

/// Who the greeting names. There is no real session yet (see [SecureSession]:
/// the stored value is the role, nothing more), so the name comes from the
/// same "signed in as" fixture each portal's own screens already greet with.
String splashGreetingName(Role role) => switch (role) {
  Role.artist => currentArtistName,
  Role.customer => seedCustomerProfile().name,
  // The aggregator fixture is a business; greet the contact person, not
  // the gallery, so the first name split below reads as a person.
  Role.aggregator => currentAggregatorContact,
};

/// Where a launch ends up once the splash is done.
String splashDestination(Role? role) => role?.home ?? LoginScreen.path;

/// This launch's quote. `main()` deals it with [nextLaunchQuote]; anywhere
/// that hasn't (a test, a preview) gets one at random.
final launchQuoteProvider = Provider<ArtQuote>(
  (ref) => artQuotes[math.Random().nextInt(artQuotes.length)],
);

const _quoteDeckKey = 'gz-launch-quote-deck';

/// The quote for this launch, dealt from a shuffled deck kept on the device:
/// every launch opens on a new one, and none comes round again until all of
/// them have been shown.
Future<ArtQuote> nextLaunchQuote() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    var deck = [
      for (final i in prefs.getStringList(_quoteDeckKey) ?? const <String>[])
        ?int.tryParse(i),
    ];
    if (deck.isEmpty || deck.any((i) => i < 0 || i >= artQuotes.length)) {
      deck = [for (var i = 0; i < artQuotes.length; i++) i]..shuffle();
    }
    final next = deck.removeAt(0);
    unawaited(prefs.setStringList(_quoteDeckKey, [for (final i in deck) '$i']));
    return artQuotes[next];
  } catch (_) {
    // No device storage to keep the deck in: any quote will do.
    return artQuotes[math.Random().nextInt(artQuotes.length)];
  }
}

/// The launch screen: the mark's opening and a quote for [splashHold], then —
/// when there is a session — a greeting, then the role's home. It is the
/// router's initial location, so it runs on every cold start and never sits
/// in the back stack (`go` replaces it).
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  static const path = '/';

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  Timer? _timer;
  bool _greeting = false;

  /// The whole opening on one clock: the halo, the mark's breath and glint,
  /// the wordmark and the quote each take their stretch of it.
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );

  @override
  void initState() {
    super.initState();
    _timer = Timer(splashHold, _afterMark);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_intro.isDismissed) return;
    if (motionOf(context)) {
      _intro.forward();
    } else {
      _intro.value = 1;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _intro.dispose();
    super.dispose();
  }

  void _afterMark() {
    if (!mounted) return;
    if (ref.read(sessionProvider) == null) return _leave();
    // Against the real API the greeting names the signed-in account. If that
    // hasn't been read yet (slow network), skip the greeting rather than hold
    // the launch up or greet a stranger.
    if (ref.read(remoteBackendProvider) &&
        ref.read(accountNameProvider).isEmpty) {
      return _leave();
    }
    setState(() => _greeting = true);
    _timer = Timer(splashGreetingHold, _leave);
  }

  void _leave() {
    if (!mounted) return;
    context.go(splashDestination(ref.read(sessionProvider)));
  }

  /// A tap anywhere moves on at once: the opening is a moment, not a wait.
  void _skip() {
    _timer?.cancel();
    _leave();
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(sessionProvider);
    final remote = ref.watch(remoteBackendProvider);
    final accountName = ref.watch(accountNameProvider);
    return Scaffold(
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _skip,
        child: Stack(
          children: [
            // The mark is centred on the whole window, as the native splash
            // draws it; only the greeting keeps clear of the system bars.
            Positioned.fill(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 450),
                child: _greeting && role != null
                    ? SafeArea(
                        child: _Greeting(
                          name: remote ? accountName : splashGreetingName(role),
                        ),
                      )
                    : _Mark(intro: _intro),
              ),
            ),
            // The quote stays through the greeting: it is this launch's.
            Positioned(
              left: 32,
              right: 32,
              bottom: MediaQuery.paddingOf(context).bottom + 36,
              child: _LaunchQuote(
                quote: ref.watch(launchQuoteProvider),
                intro: _intro,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The brand mark, centered and alone. Same asset the native splash draws, so
/// the handoff from the OS window to the first Flutter frame is invisible.
/// Falls back to the lettered mark the Auth screens use if the asset is
/// missing, so a broken image never becomes a blank launch screen.
class _Monogram extends StatelessWidget {
  const _Monogram({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Image.asset(
      brandMarkAsset,
      width: size,
      height: size,
      errorBuilder: (context, error, stack) => SizedBox(
        height: size,
        child: Center(
          child: Text(
            'GZ',
            style: theme.textTheme.displaySmall?.copyWith(
              color: theme.colorScheme.tertiary,
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

/// The opening. The mark starts exactly where the native splash drew it, so
/// the handoff never jumps; then a gold halo draws itself round it and lets go
/// — widening as it fades — while a warm glow blooms behind, the mark takes one
/// slow breath and a band of light crosses its gilt. The wordmark writes itself
/// in underneath and a gold rule draws under that.
class _Mark extends StatelessWidget {
  const _Mark({required this.intro});

  final Animation<double> intro;

  static const _size = 148.0;

  Animation<double> _phase(double begin, double end, Curve curve) =>
      CurvedAnimation(
        parent: intro,
        curve: Interval(begin, end, curve: curve),
      );

  @override
  Widget build(BuildContext context) {
    final gold = Theme.of(context).colorScheme.primary;
    final breath = _phase(0.18, 0.72, Curves.easeInOut);
    final rule = _phase(0.62, 0.95, AppMotion.enter);
    return Center(
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          FadeTransition(
            opacity: _phase(0.1, 0.6, Curves.easeOut),
            child: Container(
              width: _size * 2.2,
              height: _size * 2.2,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    gold.withValues(alpha: 0.2),
                    gold.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
          RepaintBoundary(
            child: CustomPaint(
              size: const Size.square(_size * 1.3),
              painter: _HaloPainter(
                draw: _phase(0.04, 0.42, Curves.easeInOutCubic),
                release: _phase(0.42, 0.86, Curves.easeOutCubic),
                color: gold,
              ),
            ),
          ),
          AnimatedBuilder(
            animation: breath,
            builder: (context, child) => Transform.scale(
              scale: 1 + 0.04 * math.sin(math.pi * breath.value),
              child: child,
            ),
            child: _Glint(
              sweep: _phase(0.3, 0.74, Curves.easeInOutCubic),
              child: const _Monogram(size: _size),
            ),
          ),
          Transform.translate(
            offset: const Offset(0, _size / 2 + 10),
            child: _Wordmark(reveal: _phase(0.32, 0.8, AppMotion.enter)),
          ),
          Transform.translate(
            offset: const Offset(0, _size / 2 + 34),
            child: AnimatedBuilder(
              animation: rule,
              builder: (context, _) => Container(
                width: 44 * rule.value,
                height: 1,
                color: gold.withValues(alpha: 0.7),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The halo: an arc of light drawn clockwise from the top — bright at its
/// leading edge, a tail behind — that then widens and fades away.
class _HaloPainter extends CustomPainter {
  _HaloPainter({required this.draw, required this.release, required this.color})
    : super(repaint: Listenable.merge([draw, release]));

  final Animation<double> draw;
  final Animation<double> release;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final sweep = draw.value;
    final fade = 1 - release.value;
    if (sweep == 0 || fade == 0) return;
    final rect = Rect.fromCircle(
      center: size.center(Offset.zero),
      radius: size.shortestSide / 2 * (1 + 0.22 * release.value),
    );
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * sweep,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..strokeCap = StrokeCap.round
        ..shader = SweepGradient(
          endAngle: 2 * math.pi * math.max(sweep, 0.001),
          colors: [
            color.withValues(alpha: 0.12 * fade),
            color.withValues(alpha: fade),
          ],
          transform: const GradientRotation(-math.pi / 2),
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_HaloPainter oldDelegate) => oldDelegate.color != color;
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
              Colors.white.withValues(alpha: 0.55),
              Colors.white.withValues(alpha: 0),
            ],
            stops: [
              (t - 0.12).clamp(0.0, 1.0),
              t.clamp(0.0, 1.0),
              (t + 0.12).clamp(0.0, 1.0),
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
    final style = Theme.of(context).textTheme.bodyMedium
        ?.copyWith(fontWeight: FontWeight.w500);
    return AnimatedBuilder(
      animation: reveal,
      builder: (context, _) {
        final t = reveal.value;
        final word = Text(
          'GALLERYZONE',
          style: style?.copyWith(letterSpacing: 3.5 + (1 - t) * 5),
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

/// This launch's quote at the foot of the screen: an opening mark in gold, the
/// words in Playfair italic, and who said it between two short gold rules.
/// It rises in as the opening settles, the name a beat after the words.
class _LaunchQuote extends StatelessWidget {
  const _LaunchQuote({required this.quote, required this.intro});

  final ArtQuote quote;
  final Animation<double> intro;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gold = theme.colorScheme.tertiary;
    Widget rise(double begin, double end, Widget child) {
      final shown = CurvedAnimation(
        parent: intro,
        curve: Interval(begin, end, curve: AppMotion.enter),
      );
      return FadeTransition(
        opacity: shown,
        child: AnimatedBuilder(
          animation: shown,
          builder: (context, child) => Transform.translate(
            offset: Offset(0, (1 - shown.value) * 14),
            child: child,
          ),
          child: child,
        ),
      );
    }

    Widget rule() =>
        Container(width: 18, height: 1, color: gold.withValues(alpha: 0.6));

    return Semantics(
      label: '${quote.text} — ${quote.author}',
      excludeSemantics: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          rise(
            0.36,
            0.78,
            Column(
              children: [
                Text(
                  '“',
                  style: theme.textTheme.displaySmall?.copyWith(
                    color: gold,
                    height: 0.9,
                  ),
                ),
                Text(
                  quote.text,
                  textAlign: TextAlign.center,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontStyle: FontStyle.italic,
                    fontWeight: FontWeight.w400,
                    fontSize: 18,
                    height: 1.45,
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.86),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          rise(
            0.5,
            0.9,
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                rule(),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    quote.author.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: gold,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.2,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                rule(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The mark moves to the top and the greeting takes the page — one screen, so
/// the mark travels rather than blinking out and back.
class _Greeting extends StatelessWidget {
  const _Greeting({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        const Center(child: _Monogram(size: 64)),
        const Spacer(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Reveal(
            index: 1,
            child: Text(
              'Welcome to GalleryZone,\n${name.split(' ').first}',
              style: theme.textTheme.displaySmall?.copyWith(
                fontWeight: FontWeight.w300,
                height: 1.15,
              ),
            ),
          ),
        ),
        const Spacer(flex: 3),
      ],
    );
  }
}
