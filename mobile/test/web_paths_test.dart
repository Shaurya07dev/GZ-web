import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/router/app_router.dart';
import 'package:gallery_zone/core/router/web_paths.dart';
import 'package:gallery_zone/data/models/auth.dart';
import 'package:gallery_zone/features/auth/providers/auth_providers.dart';
import 'package:gallery_zone/features/auth/role_options.dart';

/// Every site path the backend writes into a notification, an email button, a
/// push payload or a broadcast (backend/apps/api/src/mail, packages/db). A tap
/// on any of them must open a real screen in the app: "That page does not
/// exist" on a notification is a broken flow, not a cosmetic one.
const _serverPaths = [
  '/verify/aw-1',
  '/marketplace',
  '/blogs',
  '/dashboard',
  '/dashboard/messages',
  '/dashboard/coa-nfc',
  '/dashboard/support',
  '/dashboard/profile',
  '/dashboard/earnings',
  '/aggregator',
  '/aggregator/messages',
  '/aggregator/inventory',
  '/aggregator/support',
  '/aggregator/profile',
  '/aggregator/earnings',
  '/aggregator/collection',
  '/account',
  '/account/orders/o1',
  '/account/collection',
  '/account/support',
  // The website's old names, still in notifications saved before the rename.
  '/dashboard/wallet',
  '/aggregator/wallet',
];

void main() {
  group('website addresses in the app', () {
    test('the ones whose screen lives elsewhere in the app are mapped', () {
      expect(
        appPathFor('/aggregator/profile'),
        '/aggregator/dashboard/profile',
      );
      expect(appPathFor('/aggregator'), '/aggregator/dashboard');
      expect(appPathFor('/dashboard/earnings'), '/dashboard/sales');
      expect(appPathFor('/aggregator/wallet'), '/aggregator/earnings');
      // The query string and a trailing slash do not get in the way.
      expect(
        appPathFor('/aggregator/messages/?thread=t1'),
        '/aggregator/dashboard/messages?thread=t1',
      );
    });

    test(
      'an address the app already has, or one that is not ours, is left alone',
      () {
        expect(appPathFor('/aggregator/inventory'), '/aggregator/inventory');
        expect(appPathFor('/verify/aw-1'), '/verify/aw-1');
        expect(
          appPathFor('https://www.galleryzone.in/aggregator/profile'),
          'https://www.galleryzone.in/aggregator/profile',
        );
      },
    );

    test('every path the server sends resolves to a screen', () {
      final container = ProviderContainer(
        overrides: [initialRoleProvider.overrideWithValue(null)],
      );
      addTearDown(container.dispose);
      final router = container.read(routerProvider);
      addTearDown(router.dispose);

      for (final path in _serverPaths) {
        final inApp = appPathFor(path);
        final match = router.configuration.findMatch(Uri.parse(inApp));
        expect(
          match.isError,
          isFalse,
          reason: '$path (as $inApp) is not a screen in the app',
        );
      }
    });

    test('the router sends a website address to its in-app screen first', () {
      expect(
        redirectFor(Role.aggregator, '/aggregator/profile'),
        '/aggregator/dashboard/profile',
      );
      expect(
        redirectFor(Role.artist, '/dashboard/earnings'),
        '/dashboard/sales',
      );
      // Signed out, the sign-in bounce still comes after the mapping.
      expect(
        redirectFor(null, '/aggregator/dashboard/profile'),
        '/login?next=%2Faggregator%2Fdashboard%2Fprofile',
      );
    });

    test('signing in as an aggregator lands on a screen that exists', () {
      final container = ProviderContainer(
        overrides: [initialRoleProvider.overrideWithValue(null)],
      );
      addTearDown(container.dispose);
      final router = container.read(routerProvider);
      addTearDown(router.dispose);

      for (final landing in [
        landingAfterLogin(Role.aggregator),
        landingAfterRegister(Role.aggregator),
        landingAfterLogin(Role.artist),
        landingAfterRegister(Role.artist),
        landingAfterLogin(Role.customer),
      ]) {
        expect(
          router.configuration.findMatch(Uri.parse(landing)).isError,
          isFalse,
          reason: '$landing is not a registered route',
        );
      }
    });
  });
}
