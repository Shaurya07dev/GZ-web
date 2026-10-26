import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/theme/app_theme.dart';
import 'package:gallery_zone/data/models/artwork.dart';
import 'package:gallery_zone/data/models/customer.dart';
import 'package:gallery_zone/data/models/order.dart';
import 'package:gallery_zone/data/repositories/customer_repository.dart';
import 'package:gallery_zone/features/account/providers/account_providers.dart';
import 'package:gallery_zone/features/account/screens/coa_nfc_screen.dart';

import 'support/catalog_fixtures.dart';

class _Customer implements CustomerRepository {
  @override
  Future<List<CollectionItem>> listCollection() async => [
    CollectionItem(
      artwork: fixtureArtwork(
        id: 'aw-1',
        nfcLinkedAt: '2026-10-01T00:00:00.000Z',
        nfcLockedAt: '2026-10-02T00:00:00.000Z',
      ),
      source: CollectionSource.transfer,
      acquiredAt: '2026-10-03T00:00:00.000Z',
    ),
  ];

  @override
  Future<List<Address>> listAddresses() async => const [
    Address(
      id: 'address-1',
      line1: '14 Church Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      isDefault: true,
    ),
  ];

  @override
  Future<List<PhysicalCoaRequest>> listPhysicalCoaRequests() async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets(
    'collector COA board exposes certificate, locked tag, paper request, passport and transfer',
    (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 1600 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          retry: (count, error) => null,
          overrides: [
            customerRepositoryProvider.overrideWithValue(_Customer()),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const CustomerCoaNfcScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('COA issued'), findsOneWidget);
      expect(find.text('NFC tagged · locked'), findsOneWidget);
      expect(find.text('Request signed paper certificate'), findsOneWidget);
      expect(find.text('View passport'), findsOneWidget);
      expect(find.text('Transfer rights'), findsOneWidget);
    },
  );
}
