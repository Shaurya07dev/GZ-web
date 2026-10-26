import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gallery_zone/core/theme/app_theme.dart';
import 'package:gallery_zone/data/models/auth.dart';
import 'package:gallery_zone/features/auth/providers/auth_providers.dart';
import 'package:gallery_zone/features/auth/role_options.dart';
import 'package:gallery_zone/features/auth/screens/login_screen.dart';

/// The real session writes the role to the OS keystore; a test has none.
class _TestSession extends SessionNotifier {
  @override
  Future<void> signIn(Role role, {bool rememberMe = true}) async =>
      state = role;
}

/// The offline demo's Sign-in screen has one tap per portal: Demo Artist,
/// Demo Aggregator, Demo Customer. Against the real API they are not drawn.
void main() {
  Future<GoRouter> pumpLogin(WidgetTester tester, {bool remote = false}) async {
    final router = GoRouter(
      initialLocation: LoginScreen.path,
      routes: [
        GoRoute(path: LoginScreen.path, builder: (_, _) => const LoginScreen()),
        for (final role in Role.values)
          GoRoute(path: role.home, builder: (_, _) => Text('home ${role.id}')),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          initialRoleProvider.overrideWithValue(null),
          sessionProvider.overrideWith(_TestSession.new),
          if (remote) remoteBackendProvider.overrideWithValue(true),
        ],
        child: MaterialApp.router(theme: AppTheme.dark, routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    return router;
  }

  String locationOf(GoRouter router) =>
      router.routerDelegate.currentConfiguration.uri.path;

  testWidgets('the three demo buttons are on the sign-in screen', (
    tester,
  ) async {
    await pumpLogin(tester);

    expect(find.text('Try the demo'), findsOneWidget);
    expect(find.text('Demo Artist'), findsOneWidget);
    expect(find.text('Demo Aggregator'), findsOneWidget);
    expect(find.text('Demo Customer'), findsOneWidget);
  });

  for (final option in roleOptions) {
    testWidgets('Demo ${option.label} lands on that portal\'s home', (
      tester,
    ) async {
      final router = await pumpLogin(tester);

      await tester.tap(find.text('Demo ${option.label}'));
      await tester.pumpAndSettle();

      expect(locationOf(router), option.role.home);
      expect(find.text('home ${option.role.id}'), findsOneWidget);
    });
  }

  testWidgets('against the real API there are no demo buttons', (tester) async {
    await pumpLogin(tester, remote: true);

    expect(find.text('Try the demo'), findsNothing);
    expect(find.text('Demo Artist'), findsNothing);
  });
}
