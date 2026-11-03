import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/verify_url.dart';
import 'coa_layout.dart';
import 'coa_pdf.dart';

/// The Certificate of Authenticity as it is printed, shown on screen: the
/// designed artwork with every value placed at the same measured positions the
/// PDF uses (coa_pdf.dart), so what you see is what you download. A port of the
/// website's CoaCertificate.
///
/// Positions are in the artwork's own pixels, scaled to the width it is given,
/// and type is sized from the PDF's point sizes by the same scale, so it reads
/// as the paper does from a phone to a tablet. Values are real text, so a
/// screen reader announces them and a test can find them.
class CoaCertificate extends StatefulWidget {
  const CoaCertificate({super.key, required this.input});

  final CoaPdfInput input;

  @override
  State<CoaCertificate> createState() => _CoaCertificateState();
}

class _CoaCertificateState extends State<CoaCertificate> {
  Uint8List? _signature;

  @override
  void initState() {
    super.initState();
    _signature = _decode(widget.input.artistSignatureDataUrl);
  }

  @override
  void didUpdateWidget(CoaCertificate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.input.artistSignatureDataUrl !=
        widget.input.artistSignatureDataUrl) {
      _signature = _decode(widget.input.artistSignatureDataUrl);
    }
  }

  /// A drawn signature arrives as a PNG data URL. One that cannot be read
  /// leaves the line blank for a wet signature, never a broken picture.
  static Uint8List? _decode(String? dataUrl) {
    if (dataUrl == null || dataUrl.trim().isEmpty) return null;
    try {
      return base64Decode(
        dataUrl.contains(',')
            ? dataUrl.substring(dataUrl.indexOf(',') + 1)
            : dataUrl,
      );
    } on FormatException {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final input = widget.input;
    final url = verifyUrlFor(input.artworkId);
    // A fixed artwork, like the paper: the phone's text-size setting must not
    // reflow it.
    return MediaQuery.withNoTextScaling(
      child: AspectRatio(
      aspectRatio: coaTplW / coaTplH,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final px = width / coaTplW; // screen pixels per template pixel
          final pt = width / coaPageWidthPt; // screen pixels per point

          /// A value set on its baseline, left edge at [leftPx] (template px).
          Widget valueAt(
            String text, {
            required double leftPx,
            required double baselinePx,
            required double size,
            Color color = const Color(coaInk),
            double? centeredPx,
          }) {
            final style = TextStyle(
              fontFamily: 'Tinos',
              fontSize: size * pt,
              height: 1,
              color: color,
            );
            final label = Text(
              text,
              maxLines: 1,
              softWrap: false,
              style: style,
              textAlign: centeredPx == null ? TextAlign.start : TextAlign.center,
            );
            return Positioned(
              left: (centeredPx == null ? leftPx : leftPx - centeredPx / 2) * px,
              top: 0,
              child: Baseline(
                baseline: baselinePx * px,
                baselineType: TextBaseline.alphabetic,
                child: centeredPx == null
                    ? label
                    : SizedBox(width: centeredPx * px, child: label),
              ),
            );
          }

          double widthAt(String text, double size) {
            final painter = TextPainter(
              text: TextSpan(
                text: text,
                style: TextStyle(fontFamily: 'Tinos', fontSize: size),
              ),
              textDirection: TextDirection.ltr,
              maxLines: 1,
            )..layout();
            return painter.width;
          }

          final signature = _signature;
          return Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned.fill(
                child: Image.asset(
                  coaTemplateAsset,
                  fit: BoxFit.fill,
                  filterQuality: FilterQuality.medium,
                  excludeFromSemantics: true,
                ),
              ),
              for (final (baseline, value) in coaFieldRows(input))
                Builder(
                  builder: (context) {
                    final fit = fitCoaText(value, coaFieldMaxWidthPt, widthAt);
                    return valueAt(
                      fit.text,
                      leftPx: coaFieldValueX,
                      baselinePx: baseline,
                      size: fit.size,
                    );
                  },
                ),
              valueAt(
                formatCoaDate(input.coaIssueDate),
                leftPx: coaDateCenterX,
                centeredPx: 300,
                baselinePx: coaDateBaseline,
                size: coaDatePt,
              ),
              if (input.coaCertificateNumber.isNotEmpty)
                valueAt(
                  input.coaCertificateNumber,
                  leftPx: coaDateCenterX,
                  centeredPx: 300,
                  baselinePx: coaCertNoBaseline,
                  size: coaCertNoPt,
                  color: const Color(coaInk2),
                ),
              Positioned(
                left: coaQrX * px,
                top: coaQrY * px,
                width: coaQrSize * px,
                height: coaQrSize * px,
                child: Semantics(
                  image: true,
                  label: 'QR code linking to $url',
                  child: ExcludeSemantics(
                    child: ColoredBox(
                      color: Colors.white,
                      child: Padding(
                        padding: EdgeInsets.all(coaQrSize * px * 0.024),
                        child: QrImageView(
                          data: url,
                          padding: EdgeInsets.zero,
                          backgroundColor: Colors.white,
                          errorCorrectionLevel: QrErrorCorrectLevel.Q,
                          eyeStyle: const QrEyeStyle(
                            eyeShape: QrEyeShape.square,
                            color: Color(coaInk),
                          ),
                          dataModuleStyle: const QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.square,
                            color: Color(coaInk),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (signature != null)
                Positioned(
                  left: (coaSigCenterX - coaSigMaxW / 2) * px,
                  top: (coaSigBottom - coaSigMaxH) * px,
                  width: coaSigMaxW * px,
                  height: coaSigMaxH * px,
                  child: Image.memory(
                    signature,
                    fit: BoxFit.contain,
                    alignment: Alignment.bottomCenter,
                    gaplessPlayback: true,
                    semanticLabel: "Artist's signature",
                    errorBuilder: (context, error, stack) =>
                        const SizedBox.shrink(),
                  ),
                ),
            ],
          );
        },
      ),
      ),
    );
  }
}
