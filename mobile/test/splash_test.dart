import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gallery_zone/core/theme/app_theme.dart';
import 'package:gallery_zone/data/models/auth.dart';
import 'package:gallery_zone/features/auth/providers/auth_providers.dart';
import 'package:gallery_zone/features/auth/role_options.dart';
import 'package:gallery_zone/features/auth/screens/login_screen.dart';
import 'package:gallery_zone/features/splash/splash_screen.dart';

void main() {
  test('signed out lands on login, each role on its own home', () {
    expect(splashDestination(null), LoginScreen.path);
    for (final role in Role.values) {
      expect(splashDestination(role), role.home);
    }
  });

  group('the opening', () {
    Future<GoRouter> pumpSplash(WidgetTester tester, Role? role) async {
      final router = GoRouter(
        initialLocation: SplashScreen.path,
        routes: [
          GoRoute(
            path: SplashScreen.path,
            builder: (_, _) => const SplashScreen(),
          ),
          GoRoute(
            path: LoginScreen.path,
            builder: (_, _) => const Text('login'),
          ),
          for (final home in Role.values.map((r) => r.home))
            GoRoute(path: home, builder: (_, _) => Text('home $home')),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [initialRoleProvider.overrideWithValue(role)],
          child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
        ),
      );
      return router;
    }

    String locationOf(GoRouter router) =>
        router.routerDelegate.currentConfiguration.uri.path;

    testWidgets('plays to the end on its own, then opens the role\'s home', (
      tester,
    ) async {
      final router = await pumpSplash(tester, Role.artist);
      expect(find.text('GALLERYZONE'), findsOneWidget);

      await tester.pump(splashDuration - const Duration(milliseconds: 1));
      expect(locationOf(router), SplashScreen.path);

      await tester.pump(const Duration(milliseconds: 1));
      await tester.pumpAndSettle();
      expect(locationOf(router), Role.artist.home);
    });

    testWidgets('signed out, it opens on login', (tester) async {
      final router = await pumpSplash(tester, null);
      await tester.pump(splashDuration);
      await tester.pumpAndSettle();
      expect(locationOf(router), LoginScreen.path);
    });

    testWidgets('there is nothing to tap: a tap does not cut it short', (
      tester,
    ) async {
      final router = await pumpSplash(tester, null);
      await tester.tapAt(tester.getCenter(find.byType(SplashScreen)));
      await tester.pump(const Duration(milliseconds: 300));
      expect(locationOf(router), SplashScreen.path);
    });

    testWidgets('with animations off it holds briefly, then opens', (
      tester,
    ) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

      final router = await pumpSplash(tester, Role.customer);
      await tester.pump(splashStillHold - const Duration(milliseconds: 1));
      expect(locationOf(router), SplashScreen.path);

      await tester.pump(const Duration(milliseconds: 1));
      await tester.pumpAndSettle();
      expect(locationOf(router), Role.customer.home);
    });
  });
}
