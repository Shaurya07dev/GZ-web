import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import 'core/auth/firebase_rest_auth.dart';
import 'core/auth/token_manager.dart';
import 'core/backend.dart';
import 'core/config.dart';
import 'core/payments/razorpay_gateway.dart';
import 'core/push/push_providers.dart';
import 'core/router/app_router.dart';
import 'core/storage/secure_session.dart';
import 'core/theme/app_theme.dart';
import 'data/models/account.dart';
import 'data/storage/mock_db.dart';
import 'features/auth/providers/auth_providers.dart';
import 'features/auth/role_options.dart';
import 'features/splash/splash_screen.dart';

Future<void> main() async {
  // The offline mock accepts any password and fakes payments. A store build
  // must never carry it, so a release build made with GZ_MOCK refuses to start
  // rather than ship a demo that looks real.
  if (kReleaseMode && AppConfig.useMockBackend) {
    throw StateError('GZ_MOCK is set on a release build — rebuild without it');
  }
  WidgetsFlutterBinding.ensureInitialized();
  // Draw behind the status and gesture bars, which the theme makes
  // transparent — the page runs to the glass instead of stopping at a strip.
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  LicenseRegistry.addLicense(_fontLicenses);
  // Every mock repository reads collections synchronously, so the
  // shared_preferences handle behind them has to exist before the first
  // frame — same single init the web's mock-db does lazily on first read.
  await MockDb.init();
  // Read the stored session once, before the first frame, so the router can
  // decide its initial route synchronously — no loading-state branch in the
  // redirect. Offline mock: the stored value IS the session (a role). Real
  // API: the session is the refresh token; a role with no token behind it is
  // a leftover and is ignored.
  var role = RoleX.fromId(await SecureSession.getRole());
  // A new quote at the foot of the launch screen every time the app opens.
  final quote = await nextLaunchQuote();
  final overrides = <Override>[];
  if (!AppConfig.useMockBackend) {
    final tokens = TokenManager(
      auth: FirebaseRestAuth(apiKey: AppConfig.firebaseApiKey),
    );
    await tokens.load();
    if (!tokens.hasSession) role = null;
    overrides.addAll(
      remoteBackendOverrides(tokens, gateway: const RazorpayGateway()),
    );
  }
  runApp(
    ProviderScope(
      // A failed read shows its error and a "Try again" straight away. The
      // default would quietly retry for most of a minute first, and a screen
      // sitting on a spinner that long looks hung.
      retry: (retryCount, error) => null,
      overrides: [
        initialRoleProvider.overrideWithValue(role),
        launchQuoteProvider.overrideWithValue(quote),
        ...overrides,
      ],
      child: const GalleryZoneApp(),
    ),
  );
}

/// The bundled fonts' Open Font Licenses, which travel with the fonts.
Stream<LicenseEntry> _fontLicenses() async* {
  for (final (family, file) in const [
    ('Inter', 'OFL-Inter.txt'),
    ('Playfair Display', 'OFL-PlayfairDisplay.txt'),
  ]) {
    yield LicenseEntryWithLineBreaks([
      family,
    ], await rootBundle.loadString('assets/fonts/$file'));
  }
}

class GalleryZoneApp extends ConsumerWidget {
  const GalleryZoneApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // The role cached on this device is a hint for the first frame, not the
    // truth: once the server has said who this account is, make the app agree
    // — and let go of a session the server no longer recognises, an account
    // that has been closed, or an admin (who has no portal here).
    ref.listen<AsyncValue<CurrentUser?>>(accountProvider, (prev, next) {
      if (!ref.read(remoteBackendProvider)) return;
      next.whenData(ref.read(sessionProvider.notifier).reconcile);
      // FCM registration follows sign-in state. A fresh sign-in registers
      // the device's token with the backend; a sign-out revokes it so
      // pushes stop landing on this device. Initialize is idempotent and
      // safe to call on every emission.
      final fcm = ref.read(fcmServiceProvider);
      next.whenData((user) async {
        await fcm.initialize();
        if (user != null) {
          await fcm.registerForCurrentUser();
        } else if (prev?.value != null) {
          // User just signed out — revoke the token so the next
          // sign-in on this device starts clean.
          await fcm.unregisterCurrentDevice();
        }
      });
    });

    return MaterialApp.router(
      title: 'GalleryZone',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      // Light is the app's default, regardless of the device setting. The
      // dark palette is still built above and still correct; nothing selects
      // it today.
      themeMode: ThemeMode.light,
      routerConfig: ref.watch(routerProvider),
      // Screens with an app bar set the system bars through the theme; this
      // covers the ones without (splash, sign-in), so the bars never flash
      // the platform default between pages.
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: AppTheme.overlayStyleFor(Theme.of(context).brightness),
        child: child!,
      ),
    );
  }
}
