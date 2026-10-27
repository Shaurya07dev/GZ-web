import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:gallery_zone/core/theme/app_theme.dart';
import 'package:gallery_zone/features/account/widgets/customer_shell.dart';
import 'package:gallery_zone/features/auth/widgets/auth_widgets.dart';

/// On an iPhone the app behaves like an iPhone app: Apple's tab bar in the
/// portals, and no sign-in button App Review would reject. The rest of the
/// suite runs as Android, so these render the iPhone side on purpose.
void main() {
  ThemeData iphone(ThemeData theme) =>
      theme.copyWith(platform: TargetPlatform.iOS);

  testWidgets('the portals use Apple\'s tab bar, and it switches tabs', (
    tester,
  ) async {
    // A phone: from 600 wide the portals use a side rail instead.
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final router = GoRouter(
      initialLocation: '/account',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) =>
              CustomerShell(navigationShell: navigationShell),
          branches: [
            for (final destination in shellDestinations)
              StatefulShellBranch(
                routes: [
                  GoRoute(
                    path: '/${destination.label.toLowerCase()}',
                    builder: (context, state) =>
                        Center(child: Text('page ${destination.label}')),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: iphone(AppTheme.light),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CupertinoTabBar), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('page Account'), findsOneWidget);

    await tester.tap(find.text('Shop'));
    await tester.pumpAndSettle();
    expect(find.text('page Shop'), findsOneWidget);
  });

  testWidgets('no Google button on an iPhone; Android still explains it', (
    tester,
  ) async {
    // Settled, because MaterialApp animates between themes and the platform
    // only flips halfway through.
    Future<void> pump(ThemeData theme) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: theme,
          home: const Scaffold(body: SocialAuthRow()),
        ),
      );
      await tester.pumpAndSettle();
    }

    await pump(iphone(AppTheme.light));
    expect(find.text('Google'), findsNothing);

    await pump(AppTheme.light.copyWith(platform: TargetPlatform.android));
    expect(find.text('Google'), findsOneWidget);
  });
}
