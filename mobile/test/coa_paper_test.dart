import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gallery_zone/core/theme/app_theme.dart';
import 'package:gallery_zone/core/verify_url.dart';
import 'package:gallery_zone/features/coa/coa_certificate.dart';
import 'package:gallery_zone/features/coa/coa_inputs.dart';
import 'package:gallery_zone/features/coa/coa_layout.dart';
import 'package:gallery_zone/features/coa/coa_pdf.dart';
import 'package:gallery_zone/features/coa/display_card.dart';
import 'package:gallery_zone/features/coa/display_card_view.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'support/app_fonts.dart';
import 'support/catalog_fixtures.dart';

/// The two printed papers: the Certificate of Authenticity (on its designed
/// artwork) and the "FOR SALE" display card. Their rules are the website's, so
/// the same piece reads the same on both.

const _certificate = CoaPdfInput(
  artworkId: 'aw-1',
  productCode: 'GZ000004',
  title: 'Monsoon, Madurai',
  artistName: 'Ananya Rao',
  category: 'Painting',
  medium: 'Oil on canvas',
  dimensions: '24 × 36 in',
  yearCreated: 2021,
  coaCertificateNumber: 'GZ-COA-2026-0001',
  coaIssueDate: '2026-03-04',
  ownerName: 'Dev Mehta',
);

const _card = DisplayCardInput(
  artworkId: 'aw-1',
  title: 'Monsoon, Madurai',
  description: 'A study in rain light.',
  artForm: 'Rajasthan: Phad Painting',
  medium: 'Oil on canvas',
  size: '24 × 36 in',
  artworkCode: 'GZ000004',
  artistName: 'Ananya Rao',
);

/// What a screen reader announces for the code: the link it encodes.
RegExp _qrLabel(String artworkId) =>
    RegExp('QR code linking to ${RegExp.escape(verifyUrlFor(artworkId))}');

Widget _host(Widget child, {double width = 480}) => MaterialApp(
  theme: AppTheme.light,
  home: Scaffold(
    body: SingleChildScrollView(
      child: Center(child: SizedBox(width: width, child: child)),
    ),
  ),
);

void main() {
  group('the certificate\'s lines', () {
    test('are the seven ruled values, the art form carrying its type and the exclusive mark', () {
      final rows = coaFieldRows(
        const CoaPdfInput(
          artworkId: 'aw-1',
          productCode: 'GZ000004',
          title: 'T',
          artistName: 'A',
          category: 'Painting',
          artworkType: 'Rajasthan: Phad Painting',
          exclusive: true,
          medium: 'M',
          dimensions: '1 × 2 in',
          yearCreated: 2021,
          coaCertificateNumber: 'N',
          coaIssueDate: '2026-03-04',
          ownerName: 'O',
        ),
      );
      expect(rows.map((r) => r.$1), [
        coaFieldBaselines.artistName,
        coaFieldBaselines.title,
        coaFieldBaselines.artForm,
        coaFieldBaselines.medium,
        coaFieldBaselines.dimensions,
        coaFieldBaselines.yearCreated,
        coaFieldBaselines.artworkId,
      ]);
      expect(
        rows[2].$2,
        'Painting · Rajasthan: Phad Painting · Exclusive to GalleryZone',
      );
      expect(rows[6].$2, 'GZ000004');
    });

    test('say so with a dash when the piece has no size or year, and fall back to the id for a code', () {
      final rows = coaFieldRows(
        const CoaPdfInput(
          artworkId: 'aw-9',
          title: 'T',
          artistName: 'A',
          category: 'Painting',
          medium: 'M',
          coaCertificateNumber: 'N',
          coaIssueDate: '',
          ownerName: 'O',
        ),
      );
      expect(rows[4].$2, '—');
      expect(rows[5].$2, '—');
      expect(rows[6].$2, 'aw-9');
    });

    test('shrink a long value before they cut it, and cut it with an ellipsis only at the floor', () {
      // Every character is 6 wide at 12 pt, scaling with the size.
      double widthAt(String text, double size) => text.length * size * 0.5;
      // Fits at the start size.
      expect(fitCoaText('12345678', 60, widthAt).size, 12);
      expect(fitCoaText('12345678', 60, widthAt).text, '12345678');
      // Does not fit at 12 but does smaller: shrunk, whole.
      final shrunk = fitCoaText('12345678901', 60, widthAt);
      expect(shrunk.size, lessThan(12));
      expect(shrunk.size, greaterThanOrEqualTo(coaFieldMinPt));
      expect(shrunk.text, '12345678901');
      // Too long even at the floor: cut, with the ellipsis, never longer than the room.
      final cut = fitCoaText('1234567890123456789012345', 60, widthAt);
      expect(cut.size, coaFieldMinPt);
      expect(cut.text, endsWith('…'));
      expect(widthAt(cut.text, cut.size), lessThanOrEqualTo(60));
    });

    test('dates read as a person writes them, and a bad one as a dash', () {
      expect(formatCoaDate('2026-03-04'), '4 March 2026');
      expect(formatCoaDate(''), '—');
      expect(formatCoaDate('not a date'), '—');
    });
  });

  group('the certificate on screen', () {
    testWidgets('lays the values on the designed artwork, and its QR leads to the passport', (tester) async {
      final semantics = tester.ensureSemantics();
      await tester.runAsync(loadAppFonts);
      await tester.pumpWidget(_host(const CoaCertificate(input: _certificate)));
      await tester.runAsync(
        () => precacheImage(
          const AssetImage(coaTemplateAsset),
          tester.element(find.byType(CoaCertificate)),
        ),
      );
      await tester.pumpAndSettle();

      for (final text in [
        'Ananya Rao',
        'Monsoon, Madurai',
        'Painting',
        'Oil on canvas',
        '24 × 36 in',
        '2021',
        'GZ000004',
        '4 March 2026',
        'GZ-COA-2026-0001',
      ]) {
        expect(find.text(text), findsOneWidget, reason: text);
      }
      // Ownership is not printed: a certificate is permanent, ownership is not.
      expect(find.text('Dev Mehta'), findsNothing);

      // What a screen reader announces is the link the code encodes.
      expect(
        find.bySemanticsLabel(_qrLabel('aw-1')),
        findsOneWidget,
      );
      final qr = tester.widget<QrImageView>(find.byType(QrImageView));
      expect(
        qr.errorCorrectionLevel,
        QrErrorCorrectLevel.Q,
        reason: 'paper is kept for decades: it can lose a quarter and still scan',
      );
      semantics.dispose();
    });

    testWidgets('shows the artist\'s signature when there is one, and leaves the line blank when it cannot be read', (tester) async {
      await tester.runAsync(loadAppFonts);
      // A 1 x 1 PNG.
      const png =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      await tester.pumpWidget(
        _host(
          CoaCertificate(
            input: CoaPdfInput(
              artworkId: _certificate.artworkId,
              title: _certificate.title,
              artistName: _certificate.artistName,
              category: _certificate.category,
              medium: _certificate.medium,
              coaCertificateNumber: _certificate.coaCertificateNumber,
              coaIssueDate: _certificate.coaIssueDate,
              ownerName: '',
              artistSignatureDataUrl: 'data:image/png;base64,$png',
            ),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.bySemanticsLabel("Artist's signature"),
        findsOneWidget,
        reason: 'the drawn signature sits on its line',
      );

      await tester.pumpWidget(
        _host(
          const CoaCertificate(
            input: CoaPdfInput(
              artworkId: 'aw-1',
              title: 'T',
              artistName: 'A',
              category: 'C',
              medium: 'M',
              coaCertificateNumber: 'N',
              coaIssueDate: '2026-03-04',
              ownerName: '',
              artistSignatureDataUrl: 'data:image/png;base64,@@not base64@@',
            ),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.bySemanticsLabel("Artist's signature"),
        findsNothing,
        reason: 'left for a wet signature, never a broken picture',
      );
    });
  });

  group('what the papers print for a piece', () {
    test('the certificate leaves the regional tradition to the display card, as the website does', () {
      final artwork = fixtureArtwork(
        artworkType: 'Rajasthan: Phad Painting',
        exclusive: true,
      );
      final passport = fixturePassport();

      final certificate = coaInputFor(artwork, passport);
      expect(coaFieldRows(certificate)[2].$2, 'Mixed media · Exclusive to GalleryZone');
      // Read as a person writes them, not as the catalogue's slugs.
      expect(coaFieldRows(certificate)[3].$2, 'Oil on canvas');
      // The signature, number and date come from the passport, the record.
      expect(certificate.coaCertificateNumber, 'GZ-COA-2026-0001');
      expect(certificate.coaIssueDate, '2026-03-04');

      final card = displayCardInputFor(artwork, passport);
      expect(card.artForm, 'Rajasthan: Phad Painting');
      expect(card.medium, 'Oil on canvas');
      expect(card.size, '24 × 36 in');
      expect(card.artworkCode, 'GZ000004');

      // Without a tradition the card falls back to the category.
      expect(displayCardInputFor(fixtureArtwork(), passport).artForm, 'Mixed media');
    });
  });

  group('the display card\'s fitting', () {
    test('a cut lands on a word, with an ellipsis, never mid-word', () {
      expect(cutAtWord('short', 56), 'short');
      final cut = cutAtWord('Village Well study, Madhubani Painting work by Sunita Devi, signed', 30);
      expect(cut, 'Village Well study, Madhubani…');
      expect(cut.length, lessThanOrEqualTo(31));
    });

    test('a short value is large, and a longer one steps down', () {
      expect(lineFit('Ink').size, 2.0);
      expect(lineFit('Bihar: Madhubani (Mithila) Painting').size, 1.75);
    });

    test('the description takes the largest size that fits, and is cut only when the smallest does not', () {
      // Fits three lines while it is at most 40 characters at size 2, 60 at 1.85, 80 at 1.7, 100 at 1.55.
      bool fits(String text, double size) =>
          text.length <= {2.0: 40, 1.85: 60, 1.7: 80, 1.55: 100}[size]!;
      // Short: largest size, whole.
      expect(fitDescription('A study in rain light.', fits), (size: 2.0, text: 'A study in rain light.'));
      // Medium: a smaller size, still whole.
      final medium = fitDescription('x ' * 35, fits); // 69 characters once trimmed
      expect(medium.size, 1.7);
      expect(medium.text, ('x ' * 35).trim());
      // Very long: the smallest size, cut at a word, with an ellipsis.
      final long = fitDescription(List.filled(80, 'word').join(' '), fits);
      expect(long.size, 1.55);
      expect(long.text, endsWith('…'));
      expect(long.text.length, lessThanOrEqualTo(101));
      expect(long.text.replaceAll('…', '').trim().split(' ').every((w) => w == 'word'), isTrue, reason: 'no word was cut in half');
    });
  });

  group('the display card on screen', () {
    testWidgets('carries the piece\'s details, and a QR to the passport that scans through its seal', (tester) async {
      final semantics = tester.ensureSemantics();
      await tester.runAsync(loadAppFonts);
      await tester.pumpWidget(_host(const DisplayCard(input: _card), width: 900));
      await tester.runAsync(
        () => precacheImage(
          const AssetImage('assets/brand/gz-logo.png'),
          tester.element(find.byType(DisplayCard)),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('FOR SALE'), findsWidgets);
      expect(find.text('ARTWORK TITLE:'), findsOneWidget);
      expect(find.text('Monsoon, Madurai'), findsOneWidget);
      expect(find.text('ART FORM:'), findsOneWidget);
      expect(find.text('Rajasthan: Phad Painting'), findsOneWidget);
      expect(find.text('24 × 36 in'), findsOneWidget);
      expect(find.text('GZ000004'), findsOneWidget);
      expect(find.text('SCAN TO EXPLORE'), findsOneWidget);
      expect(find.textContaining('A study in rain light.'), findsOneWidget);
      expect(find.textContaining('Ananya Rao'), findsOneWidget);

      expect(
        find.bySemanticsLabel(_qrLabel('aw-1')),
        findsOneWidget,
      );
      final qr = tester.widget<QrImageView>(find.byType(QrImageView));
      expect(
        qr.errorCorrectionLevel,
        QrErrorCorrectLevel.H,
        reason: 'the GZ seal covers the middle of the code, which must scan through it',
      );
      semantics.dispose();
    });

    testWidgets('prints as one page at the card\'s size, handed to the print dialog', (tester) async {
      await tester.runAsync(loadAppFonts);
      Uint8List? printed;
      String? name;
      var width = 0.0;
      await tester.pumpWidget(
        _host(
          DisplayCardView(
            input: _card,
            print: (bytes, fileName, format) async {
              printed = bytes;
              name = fileName;
              width = format.width;
            },
          ),
          width: 360,
        ),
      );
      await tester.runAsync(
        () => precacheImage(
          const AssetImage('assets/brand/gz-logo.png'),
          tester.element(find.byType(DisplayCard)),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Print display card'));
      // Capturing the card and building the PDF is real asynchronous work.
      for (var i = 0; i < 200 && printed == null; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 25)),
        );
        await tester.pump();
      }

      expect(printed, isNotNull, reason: 'the card was captured and sent to print');
      expect(latin1.decode(printed!.sublist(0, 4)), '%PDF');
      expect(name, 'GalleryZone-display-card-GZ000004');
      // 148 mm wide, in points.
      expect(width, closeTo(148 / 25.4 * 72, 0.01));
    });
  });
}
