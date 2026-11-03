import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/verify_url.dart';
import 'coa_layout.dart';

/// The Certificate of Authenticity, drawn onto GalleryZone's designed
/// certificate (assets/coa/coa-template.png), the same artwork the website
/// prints on. A port of the website's coa-pdf.ts: everything variable is laid
/// over the template at measured positions (coa_layout.dart), so nothing about
/// the design lives here.
///
/// Ownership is not printed, on purpose: a certificate is a permanent object
/// but ownership changes. The QR resolves to the live passport, so the paper
/// never goes stale or contradicts the ledger. The artist's signature is the
/// one drawn when they signed their MOU; an artist who signed before the pad
/// existed has none, and the line is left for a wet signature.

/// What the certificate prints.
class CoaPdfInput {
  const CoaPdfInput({
    required this.artworkId,
    required this.title,
    required this.artistName,
    required this.category,
    required this.medium,
    required this.coaCertificateNumber,
    required this.coaIssueDate,
    required this.ownerName,
    this.artworkType,
    this.exclusive = false,
    this.artistSignatureDataUrl,
    this.productCode,
    this.dimensions,
    this.yearCreated,
  });

  final String artworkId;
  final String? productCode;
  final String title;
  final String artistName;
  final String category;
  final String medium;
  final String? dimensions;
  final int? yearCreated;
  final String coaCertificateNumber;
  final String coaIssueDate;

  /// The current legal owner as the passport records it. Not printed (see the
  /// note above); kept so callers need not change.
  final String ownerName;
  final String? artworkType;
  final bool exclusive;
  final String? artistSignatureDataUrl;

  /// The file the person is offered.
  String get fileName => 'GalleryZone-CoA-$coaCertificateNumber.pdf';
}

/// The designed artwork, bundled.
const coaTemplateAsset = 'assets/coa/coa-template.png';

/// The seven ruled values and the baseline each sits on. Shared by the PDF and
/// the certificate on screen so the two can never disagree about what a field
/// says.
///
/// The ART FORM line carries the category and, when known, the regional
/// tradition, with the "Exclusive to GalleryZone" marker after them.
List<(double, String)> coaFieldRows(CoaPdfInput input) {
  final type = input.artworkType?.trim() ?? '';
  final artForm = [
    input.category,
    if (type.isNotEmpty) type,
    if (input.exclusive) 'Exclusive to GalleryZone',
  ].join(' · ');
  final year = input.yearCreated;
  final dimensions = input.dimensions ?? '';
  return [
    (coaFieldBaselines.artistName, input.artistName),
    (coaFieldBaselines.title, input.title),
    (coaFieldBaselines.artForm, artForm),
    (coaFieldBaselines.medium, input.medium),
    (coaFieldBaselines.dimensions, dimensions.isEmpty ? '—' : dimensions),
    (coaFieldBaselines.yearCreated, year == null ? '—' : '$year'),
    (
      coaFieldBaselines.artworkId,
      (input.productCode ?? '').isEmpty ? input.artworkId : input.productCode!,
    ),
  ];
}

/// "31 October 2026", or a dash for a date that isn't one.
String formatCoaDate(String iso) {
  final date = DateTime.tryParse(iso);
  return date == null ? '—' : DateFormat('d MMMM y').format(date.toLocal());
}

/// A field value on its ruled line: the type shrinks only as far as it has to,
/// and only then is the value cut, with an ellipsis, rather than running over
/// the rule into the declaration column. [widthAt] measures [text] set at a
/// point size, in points.
({String text, double size}) fitCoaText(
  String text,
  double maxWidthPt,
  double Function(String text, double size) widthAt, {
  String ellipsis = '…',
}) {
  var size = coaFieldStartPt;
  while (widthAt(text, size) > maxWidthPt && size > coaFieldMinPt) {
    size -= 0.5;
  }
  var out = text;
  if (widthAt(out, size) > maxWidthPt) {
    while (out.length > 1 && widthAt('$out$ellipsis', size) > maxWidthPt) {
      out = out.substring(0, out.length - 1);
    }
    out = '$out$ellipsis';
  }
  return (text: out, size: size);
}

/// The room for a value on its ruled line, in points.
const coaFieldMaxWidthPt = coaFieldValueMaxW * coaPtPerPx;

/// The PDF's built-in fonts cover Latin-1 only. Typographic punctuation that
/// titles and names often carry is mapped to its plain equivalent, and anything
/// else outside the range becomes a question mark rather than a blank.
String pdfSafe(String text) {
  const swaps = {
    '‘': "'",
    '’': "'",
    '“': '"',
    '”': '"',
    '–': '-',
    '—': '-',
    '−': '-',
    '→': '->',
    '…': '...',
    ' ': ' ',
  };
  final out = StringBuffer();
  for (final rune in text.runes) {
    final char = String.fromCharCode(rune);
    out.write(swaps[char] ?? (rune <= 0xFF ? char : '?'));
  }
  return out.toString();
}

/// The artwork's QR as a PNG: dark ink on white with one module of quiet zone
/// around it, as the website's is. Error correction Q: a certificate is kept
/// for decades, through creases, stains and fading, so it can lose a quarter of
/// the code and still scan.
Future<Uint8List> coaQrPng(String url, {int size = 1024}) async {
  const ink = ui.Color(coaInk);
  final painter = QrPainter(
    data: url,
    version: QrVersions.auto,
    errorCorrectionLevel: QrErrorCorrectLevel.Q,
    gapless: true,
    eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: ink),
    dataModuleStyle: const QrDataModuleStyle(
      dataModuleShape: QrDataModuleShape.square,
      color: ink,
    ),
  );
  final side = size.toDouble();
  // One module of a ~41-module code.
  final quiet = side * 0.024;
  final recorder = ui.PictureRecorder();
  final canvas = ui.Canvas(recorder);
  canvas.drawRect(
    ui.Rect.fromLTWH(0, 0, side, side),
    ui.Paint()..color = const ui.Color(0xFFFFFFFF),
  );
  canvas.translate(quiet, quiet);
  painter.paint(canvas, ui.Size(side - quiet * 2, side - quiet * 2));
  final image = await recorder.endRecording().toImage(size, size);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

/// The digital Certificate of Authenticity as a PDF: the designed artwork with
/// every value on it, ready to print. [compress] exists so a test can read the
/// text back out.
Future<Uint8List> buildCoaPdf(
  CoaPdfInput input, {
  bool compress = true,
}) async {
  final template = pw.MemoryImage(
    (await rootBundle.load(coaTemplateAsset)).buffer.asUint8List(),
  );
  final qr = pw.MemoryImage(await coaQrPng(verifyUrlFor(input.artworkId)));
  final signature = _signatureImage(input.artistSignatureDataUrl);

  final doc = pw.Document(
    title: 'Certificate of Authenticity',
    author: 'GalleryZone',
    // Where the QR leads, readable without scanning it.
    subject: verifyUrlFor(input.artworkId),
    compress: compress,
  );
  doc.addPage(
    pw.Page(
      pageFormat: const PdfPageFormat(coaPageWidthPt, coaPageHeightPt),
      margin: pw.EdgeInsets.zero,
      build: (context) {
        final font = pw.Font.times().getFont(context);
        final templateImage = template.buildImage(context);
        final qrImage = qr.buildImage(context);
        final signatureImage = signature?.buildImage(context);

        // jsPDF-style: positions are measured from the page's top and text is
        // set on its baseline; the PDF canvas counts up from the bottom.
        double fromTop(double px) => coaPageHeightPt - px * coaPtPerPx;
        double widthAt(String text, double size) =>
            font.stringMetrics(text).advanceWidth * size;

        return pw.CustomPaint(
          size: const PdfPoint(coaPageWidthPt, coaPageHeightPt),
          painter: (canvas, size) {
            canvas.drawImage(
              templateImage,
              0,
              0,
              coaPageWidthPt,
              coaPageHeightPt,
            );

            // The seven ruled fields.
            canvas.setFillColor(const PdfColor.fromInt(coaInk));
            for (final (baseline, value) in coaFieldRows(input)) {
              final fit = fitCoaText(
                pdfSafe(value),
                coaFieldMaxWidthPt,
                widthAt,
                ellipsis: '...',
              );
              canvas.drawString(
                font,
                fit.size,
                fit.text,
                coaFieldValueX * coaPtPerPx,
                fromTop(baseline),
              );
            }

            // Date of issue, centred under its printed label.
            final date = formatCoaDate(input.coaIssueDate);
            final dateText = pdfSafe(date);
            canvas.drawString(
              font,
              coaDatePt,
              dateText,
              coaDateCenterX * coaPtPerPx -
                  widthAt(dateText, coaDatePt) / 2,
              fromTop(coaDateBaseline),
            );

            // The certificate's own number: the template has no field for it
            // ("ARTWORK ID" is the artwork's code, a different thing), so it
            // sits quietly under the date, where it can still be quoted in
            // correspondence.
            if (input.coaCertificateNumber.isNotEmpty) {
              final number = pdfSafe(input.coaCertificateNumber);
              canvas.setFillColor(const PdfColor.fromInt(coaInk2));
              canvas.drawString(
                font,
                coaCertNoPt,
                number,
                coaDateCenterX * coaPtPerPx -
                    widthAt(number, coaCertNoPt) / 2,
                fromTop(coaCertNoBaseline),
              );
            }

            // The QR, in the panel the template reserves for it.
            canvas.drawImage(
              qrImage,
              coaQrX * coaPtPerPx,
              fromTop(coaQrY + coaQrSize),
              coaQrSize * coaPtPerPx,
              coaQrSize * coaPtPerPx,
            );

            // The artist's signature, sitting on the line above its printed
            // label. Fitted inside its box without distorting: a signature
            // stretched to fill a fixed box stops looking like the person's
            // hand, which is the only thing it is there to be.
            if (signature != null && signatureImage != null) {
              final width = (signature.width ?? 1).toDouble();
              final height = (signature.height ?? 1).toDouble();
              final scale = (coaSigMaxW / width) < (coaSigMaxH / height)
                  ? coaSigMaxW / width
                  : coaSigMaxH / height;
              final w = width * scale;
              final h = height * scale;
              canvas.drawImage(
                signatureImage,
                (coaSigCenterX - w / 2) * coaPtPerPx,
                fromTop(coaSigBottom),
                w * coaPtPerPx,
                h * coaPtPerPx,
              );
            }
          },
        );
      },
    ),
  );
  return doc.save();
}

pw.MemoryImage? _signatureImage(String? dataUrl) {
  if (dataUrl == null || dataUrl.trim().isEmpty) return null;
  try {
    final encoded = dataUrl.contains(',')
        ? dataUrl.substring(dataUrl.indexOf(',') + 1)
        : dataUrl;
    return pw.MemoryImage(base64Decode(encoded));
  } on Exception {
    // Keep certificate downloads working if an old MOU contains a malformed
    // (or undecodable) signature. The line remains available for a wet
    // signature.
    return null;
  }
}
