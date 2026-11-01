import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/theme/app_theme.dart';
import 'package:gallery_zone/core/verify_url.dart';
import 'package:gallery_zone/data/models/artwork.dart';
import 'package:gallery_zone/data/models/passport.dart';
import 'package:gallery_zone/data/storage/mock_db.dart';
import 'package:gallery_zone/features/artist/screens/coa_nfc_screen.dart';
import 'package:gallery_zone/features/artist/widgets/artwork_history.dart';
import 'package:gallery_zone/features/auth/providers/auth_providers.dart';
import 'package:gallery_zone/features/coa/coa_certificate.dart';
import 'package:gallery_zone/features/coa/coa_pdf.dart';
import 'package:gallery_zone/features/coa/download_coa_button.dart';
import 'package:gallery_zone/features/coa/paper_view.dart';
import 'package:gallery_zone/features/marketplace/providers/marketplace_providers.dart';
import 'package:gallery_zone/features/marketplace/screens/passport_screen.dart';
import 'package:gallery_zone/features/marketplace/widgets/artwork_qr.dart';
import 'package:gallery_zone/features/ownership/providers/ownership_providers.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/catalog_fixtures.dart';
import 'support/app_fonts.dart';
import 'support/fake_repositories.dart';

CoaPdfInput _input({
  String number = 'GZ-COA-2026-0001',
  String title = 'Monsoon, Madurai',
}) => CoaPdfInput(
  artworkId: 'aw-1',
  productCode: 'GZ000004',
  title: title,
  artistName: 'Ananya Rao',
  category: 'Mixed media',
  artworkType: 'Rajasthan: Phad Painting',
  exclusive: true,
  medium: 'Oil on canvas',
  dimensions: '24 × 36 in',
  yearCreated: 2021,
  coaCertificateNumber: number,
  coaIssueDate: '2026-03-04',
  ownerName: 'Dev Mehta',
);

Widget _app(Widget home, {FakeCatalog? catalog, FakeOwnership? ownership}) =>
    ProviderScope(
      retry: (retryCount, error) => null,
      overrides: [
        artworkRepositoryProvider.overrideWithValue(
          catalog ??
              FakeCatalog(
                artworks: [fixtureArtwork()],
                artists: [fixtureArtist()],
              ),
        ),
        ownershipRepositoryProvider.overrideWithValue(
          ownership ?? FakeOwnership(passports: {'aw-1': fixturePassport()}),
        ),
        initialRoleProvider.overrideWithValue(null),
      ],
      child: MaterialApp(theme: AppTheme.light, home: home),
    );

void _phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    MockDb.resetForTesting();
    await MockDb.init();
  });

  group('the verification link', () {
    test('is one address on the real site, whatever the artwork id holds', () {
      expect(verifyUrlFor('aw-1'), 'https://www.galleryzone.art/verify/aw-1');
      expect(
        verifyUrlFor('a b/c'),
        'https://www.galleryzone.art/verify/a%20b%2Fc',
      );
    });
  });

  group('the certificate PDF', () {
    testWidgets(
      'is the designed certificate with the piece\x27s values on it and the verify link behind its QR',
      (tester) async {
        // Loading the artwork and drawing the QR are real asynchronous work.
        final bytes = (await tester.runAsync(
          () => buildCoaPdf(_input(), compress: false),
        ))!;
        final raw = latin1.decode(bytes, allowInvalid: true);
        expect(raw.startsWith('%PDF'), isTrue);

        // The page is the designed artwork: its own pixels, edge to edge, in
        // A4 landscape's width and the artwork's proportions.
        expect(raw, contains('/Width 1280'));
        expect(raw, contains('/Height 853'));
        expect(raw, contains('/MediaBox[0 0 841.88976 561.0406]'));

        // The values on it, each set whole on its own line.
        final text = [
          for (final match in RegExp(r'\[\((.*?)\)\]TJ').allMatches(raw))
            match.group(1)!,
        ];
        expect(
          text,
          containsAll([
            'Ananya Rao',
            'Monsoon, Madurai',
            'Oil on canvas',
            'GZ000004',
            '2021',
            '4 March 2026',
            'GZ-COA-2026-0001',
          ]),
        );
        expect(text.any((line) => line.contains('24 × 36 in')), isTrue);
        expect(
          text.any((line) => line.startsWith('Mixed media · Rajasthan')),
          isTrue,
          reason: 'the art form leads with the category, then its tradition',
        );

        // Ownership is not printed: a certificate is permanent, ownership is not.
        expect(raw, isNot(contains('Dev Mehta')));
        // Where the QR leads, readable in the file's properties.
        expect(
          raw,
          contains('/Subject(https://www.galleryzone.art/verify/aw-1)'),
        );
      },
    );

    test('typographic punctuation in a title survives the built-in font', () {
      expect(
        pdfSafe('Monsoon’s “end” – a study…'),
        'Monsoon\'s "end" - a study...',
      );
      expect(pdfSafe('Café'), 'Café', reason: 'Latin-1 is fine as it is');
      expect(
        pdfSafe('आकाश'),
        '????',
        reason: 'what the font cannot draw is marked, not blank',
      );
    });

    test('is named after the certificate', () {
      expect(_input().fileName, 'GalleryZone-CoA-GZ-COA-2026-0001.pdf');
    });

    testWidgets('the button hands the finished file to the share sheet', (
      tester,
    ) async {
      Uint8List? shared;
      String? name;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: Center(
              child: DownloadCoaButton(
                certificate: _input(),
                share: (bytes, fileName) async {
                  shared = bytes;
                  name = fileName;
                },
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Download certificate (PDF)'));
      // Building the PDF is real asynchronous work.
      for (var i = 0; i < 200 && shared == null; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 25)),
        );
        await tester.pump();
      }
      expect(name, 'GalleryZone-CoA-GZ-COA-2026-0001.pdf');
      expect(latin1.decode(shared!.sublist(0, 4)), '%PDF');
    });

    testWidgets('the button waits for a certificate number', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: Center(
              child: DownloadCoaButton(certificate: _input(number: '')),
            ),
          ),
        ),
      );
      final button = tester.widget<OutlinedButton>(find.byType(OutlinedButton));
      expect(button.onPressed, isNull);
    });
  });

  group('the QR code', () {
    testWidgets('encodes the same link the tag carries', (tester) async {
      final semantics = tester.ensureSemantics();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: Center(child: ArtworkQr(artworkId: 'aw-1', showUrl: true)),
          ),
        ),
      );
      expect(find.byType(QrImageView), findsOneWidget);
      // What a screen reader announces is the link the code encodes.
      expect(
        find.bySemanticsLabel(
          RegExp('QR code linking to ${RegExp.escape(verifyUrlFor('aw-1'))}'),
        ),
        findsOneWidget,
      );
      expect(find.text(verifyUrlFor('aw-1')), findsOneWidget);
      semantics.dispose();
    });
  });

  group('the artist\'s certificate and display card', () {
    Future<void> open(
      WidgetTester tester, {
      PaperTab tab = PaperTab.certificate,
    }) async {
      _phone(tester);
      await tester.runAsync(loadAppFonts);
      await tester.pumpWidget(
        _app(
          CertificatePreviewScreen(
            artwork: fixtureArtwork(
              artworkType: 'Rajasthan: Phad Painting',
              exclusive: true,
            ),
            initialTab: tab,
          ),
        ),
      );
      await tester.runAsync(
        () => precacheImage(
          const AssetImage(coaTemplateAsset),
          tester.element(find.byType(CertificatePreviewScreen)),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets(
      'the preview is the designed certificate, with its download, and the display card beside it',
      (tester) async {
        await open(tester);

        // The certificate itself, on its artwork, with its download.
        expect(find.byType(CoaCertificate), findsOneWidget);
        expect(find.text('GZ-COA-2026-0001'), findsOneWidget);
        expect(find.text('Download certificate (PDF)'), findsOneWidget);
        expect(find.text('FOR SALE'), findsNothing);

        // The display card is one tap away, in the same place.
        await tester.tap(find.text('Display card'));
        await tester.pumpAndSettle();
        expect(find.text('FOR SALE'), findsWidgets);
        expect(find.text('Print display card'), findsOneWidget);
        expect(find.byType(CoaCertificate), findsNothing);

        // And back.
        await tester.tap(find.text('Certificate'));
        await tester.pumpAndSettle();
        expect(find.byType(CoaCertificate), findsOneWidget);

        // The first hand-over of the piece stays where it was.
        expect(find.text('Transfer rights'), findsOneWidget);
      },
    );

    testWidgets('opens on the display card when that is what was asked for', (
      tester,
    ) async {
      await open(tester, tab: PaperTab.card);
      expect(find.text('FOR SALE'), findsWidgets);
      expect(find.text('Print display card'), findsOneWidget);
      expect(find.byType(CoaCertificate), findsNothing);
    });

    testWidgets(
      'tapping a paper opens it full screen to pinch and zoom, and closing returns to it',
      (tester) async {
        await open(tester);

        await tester.tap(find.byType(CoaCertificate));
        await tester.pumpAndSettle();
        expect(find.byType(InteractiveViewer), findsOneWidget);
        expect(find.text('Pinch to zoom'), findsOneWidget);

        await tester.tap(find.byType(CloseButton));
        await tester.pumpAndSettle();
        expect(find.byType(InteractiveViewer), findsNothing);
        expect(find.text('Download certificate (PDF)'), findsOneWidget);
      },
    );

    testWidgets('the full passport is one tap further', (tester) async {
      await open(tester);
      await tester.scrollUntilVisible(find.text('View full passport'), 200);
      await tester.tap(find.text('View full passport'));
      await tester.pumpAndSettle();
      expect(find.text('COA issued 4 March 2026'), findsOneWidget);
    });
  });

  group('the passport page', () {
    testWidgets(
      'shows the certificate, who owns it and where, and the record of hand-overs',
      (tester) async {
        _phone(tester);
        final catalog = FakeCatalog(
          artworks: [
            fixtureArtwork(
              artworkType: 'Rajasthan: Phad Painting',
              exclusive: true,
            ),
          ],
          artists: [fixtureArtist()],
        );
        final ownership = FakeOwnership(
          passports: {
            'aw-1': fixturePassport(
              lifecycle: const [
                LifecycleEntry(
                  id: 'ev-1',
                  kind: LifecycleKind.displayed,
                  at: '2026-04-02T10:00:00.000Z',
                  actorKind: LifecycleActorKind.collector,
                  actorName: 'Gallery Nine',
                ),
                LifecycleEntry(
                  id: 'ev-2',
                  kind: LifecycleKind.transferred,
                  at: '2026-05-02T10:00:00.000Z',
                  actorKind: LifecycleActorKind.collector,
                  actorName: 'Dev Mehta',
                ),
              ],
              events: [
                fixtureEvent(
                  id: 'ev-2',
                  to: 'Dev Mehta',
                  initiatedAt: '2026-05-01T10:00:00.000Z',
                  acceptedAt: '2026-05-02T10:00:00.000Z',
                ),
                fixtureEvent(
                  id: 'ev-1',
                  from: 'Ananya Rao',
                  to: 'Gallery Nine',
                  kind: TransferKind.display,
                  initiatedAt: '2026-04-01T10:00:00.000Z',
                  acceptedAt: '2026-04-02T10:00:00.000Z',
                ),
                fixtureEvent(
                  id: 'ev-x',
                  to: 'Nobody',
                  status: TransferStatus.cancelled,
                  initiatedAt: '2026-06-01T10:00:00.000Z',
                  acceptedAt: null,
                ),
              ],
            ),
          },
        );
        await tester.pumpWidget(
          _app(
            const PassportScreen(artworkId: 'aw-1'),
            catalog: catalog,
            ownership: ownership,
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('ARTWORK PASSPORT'), findsOneWidget);
        expect(find.text('Monsoon, Madurai'), findsOneWidget);
        expect(find.text('GZ-COA-2026-0001'), findsOneWidget);
        expect(find.text('Exclusive to GalleryZone'), findsOneWidget);
        expect(
          find.text('Dev Mehta'),
          findsWidgets,
          reason: 'the owner, from the public record',
        );
        expect(find.text('COA issued 4 March 2026'), findsOneWidget);

        // The record of hand-overs now lives in the lifecycle (NFC_IMPLEMENTATION.md §6).
        await tester.scrollUntilVisible(find.text('LIFECYCLE'), 300);
        expect(
          find.text('Lent to Gallery Nine for display'),
          findsOneWidget,
          reason: 'a loan is marked as one',
        );
        expect(find.text('Handed over to Dev Mehta'), findsOneWidget);
        expect(
          find.textContaining('Nobody'),
          findsNothing,
          reason: 'a cancelled hand-over never happened',
        );
      },
    );

    testWidgets('says a physical tag is linked, but never which chip', (
      tester,
    ) async {
      _phone(tester);
      final ownership = FakeOwnership(
        passports: {'aw-1': fixturePassport(nfcLinked: true, nfcLocked: true)},
      );
      await tester.pumpWidget(
        _app(const PassportScreen(artworkId: 'aw-1'), ownership: ownership),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Verified via NFC + locked'),
        findsWidgets,
        reason: 'the banner and the chip on the card',
      );
      expect(find.byKey(const Key('passport-nfc-chip')), findsOneWidget);
      expect(find.textContaining('04a1b2c3d4e580'), findsNothing);
    });

    testWidgets(
      'a tag that is linked but not locked is not presented as sealed',
      (tester) async {
        _phone(tester);
        final ownership = FakeOwnership(
          passports: {'aw-1': fixturePassport(nfcLinked: true)},
        );
        await tester.pumpWidget(
          _app(const PassportScreen(artworkId: 'aw-1'), ownership: ownership),
        );
        await tester.pumpAndSettle();

        expect(find.text('NFC tag linked — not yet locked'), findsOneWidget);
        expect(find.text('NFC tag linked · not yet locked'), findsOneWidget);
        expect(find.text('Verified via NFC + locked'), findsNothing);
      },
    );

    testWidgets('a piece with no tag shows no NFC badge', (tester) async {
      _phone(tester);
      await tester.pumpWidget(_app(const PassportScreen(artworkId: 'aw-1')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('passport-nfc-chip')), findsNothing);
      expect(find.textContaining('NFC tag linked'), findsNothing);
    });

    testWidgets(
      'carries the QR and the certificate download once a number exists',
      (tester) async {
        _phone(tester);
        await tester.pumpWidget(_app(const PassportScreen(artworkId: 'aw-1')));
        await tester.pumpAndSettle();

        await tester.scrollUntilVisible(find.byType(QrImageView), 300);
        await tester.scrollUntilVisible(
          find.text('Download certificate (PDF)'),
          300,
        );
        expect(find.text('Download certificate (PDF)'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('View portfolio'), 300);
        expect(find.text('Verified GalleryZone artist'), findsOneWidget);
      },
    );

    testWidgets(
      'before a number is issued the card says so and the download waits',
      (tester) async {
        _phone(tester);
        final ownership = FakeOwnership(
          passports: {
            'aw-1': fixturePassport(coaNumber: null, coaIssuedAt: null),
          },
        );
        await tester.pumpWidget(
          _app(const PassportScreen(artworkId: 'aw-1'), ownership: ownership),
        );
        await tester.pumpAndSettle();

        expect(find.text('Pending issuance'), findsOneWidget);
        expect(find.textContaining('COA issued'), findsNothing);
      },
    );

    testWidgets('a tag that resolves to nothing says so', (tester) async {
      _phone(tester);
      await tester.pumpWidget(_app(const PassportScreen(artworkId: 'nope')));
      await tester.pumpAndSettle();
      expect(find.text('No passport for this tag'), findsOneWidget);
    });

    testWidgets('a failed load can be tried again', (tester) async {
      _phone(tester);
      final ownership = FakeOwnership(passports: {'aw-1': fixturePassport()})
        ..failPassport = true;
      await tester.pumpWidget(
        _app(const PassportScreen(artworkId: 'aw-1'), ownership: ownership),
      );
      await tester.pumpAndSettle();
      expect(find.text("The passport didn't load"), findsOneWidget);

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('ARTWORK PASSPORT'), findsOneWidget);
    });
  });

  group('an artwork\'s history', () {
    test('splits who owns it from who has been allowed to show it', () {
      final artwork = fixtureArtwork(
        nfcTagUid: '04a1b2c3d4e580',
        nfcLinkedAt: '2026-03-10T00:00:00.000Z',
        history: const [
          ArtworkStatusEvent(
            status: ArtworkStatus.pendingApproval,
            changedAt: '2026-03-01T00:00:00.000Z',
          ),
          ArtworkStatusEvent(
            status: ArtworkStatus.marketplace,
            changedAt: '2026-03-04T00:00:00.000Z',
          ),
          ArtworkStatusEvent(
            status: ArtworkStatus.withAggregator,
            changedAt: '2026-04-10T00:00:00.000Z',
          ),
          ArtworkStatusEvent(
            status: ArtworkStatus.returned,
            changedAt: '2026-05-10T00:00:00.000Z',
          ),
        ],
      );
      final history = ArtworkHistoryView.buildHistory(
        artwork,
        const [],
        const [],
      );

      expect(history.ownership.map((e) => e.label), [
        'NFC tag linked',
        'Approved and listed for sale',
        'Certificate of Authenticity issued',
        'Submitted to GalleryZone for review',
      ]);
      expect(history.display.map((e) => e.label), [
        'Came back from display',
        'On display with an aggregator',
      ]);
      expect(history.onDisplayNow, isFalse);
      expect(history.ownerName, 'Ananya Rao');
    });

    test('a running display loan is the live state, and a pending offer is only awaited', () {
      final future = DateTime.now()
          .add(const Duration(days: 20))
          .toIso8601String();
      final transfers = [
        OwnershipTransfer(
          id: 't1',
          artworkId: 'aw-1',
          artworkTitle: 'Monsoon, Madurai',
          fromName: 'Ananya Rao',
          toName: 'Gallery Nine',
          toEmail: '',
          initiatedAt: '2026-09-01T00:00:00.000Z',
          acceptedAt: '2026-09-02T00:00:00.000Z',
          status: TransferStatus.accepted,
          kind: TransferKind.display,
          displayEndsAt: future,
        ),
        OwnershipTransfer(
          id: 't2',
          artworkId: 'aw-1',
          artworkTitle: 'Monsoon, Madurai',
          fromName: 'Ananya Rao',
          toName: 'Dev Mehta',
          toEmail: '',
          initiatedAt: '2026-09-20T00:00:00.000Z',
          status: TransferStatus.pending,
          kind: TransferKind.ownership,
        ),
      ];
      final history = ArtworkHistoryView.buildHistory(
        fixtureArtwork(),
        transfers,
        const [],
      );

      expect(history.onDisplayNow, isTrue);
      expect(history.display.first.state, HistoryState.current);
      expect(history.ownership.first.state, HistoryState.pending);
      expect(history.ownership.first.label, 'Transfer to Dev Mehta');
    });
  });
}
