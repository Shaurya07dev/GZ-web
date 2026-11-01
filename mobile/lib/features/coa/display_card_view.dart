import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'display_card.dart';
import 'download_coa_button.dart';
import 'zoomable_paper.dart';

typedef PrintPdf =
    Future<void> Function(Uint8List bytes, String name, PdfPageFormat format);

/// Opens the phone's print dialog (which also saves as PDF) for [bytes].
Future<void> printPdfDocument(
  Uint8List bytes,
  String name,
  PdfPageFormat format,
) => Printing.layoutPdf(name: name, format: format, onLayout: (_) async => bytes);

/// The card's printed size: 148 mm wide, in the design's own proportions.
const displayCardPageFormat = PdfPageFormat(
  148 * PdfPageFormat.mm,
  148 * PdfPageFormat.mm * 630 / 1000,
);

/// A one-page PDF at the card's print size, edge to edge, from a picture of the
/// card. The pixels go in as they are, with no PNG round trip to slow a phone.
Future<Uint8List> displayCardPdf(ui.Image card) async {
  final pixels = (await card.toByteData(
    format: ui.ImageByteFormat.rawRgba,
  ))!.buffer.asUint8List();
  final image = pw.RawImage(
    bytes: pixels,
    width: card.width,
    height: card.height,
  );
  final doc = pw.Document(title: 'Display card', author: 'GalleryZone');
  doc.addPage(
    pw.Page(
      pageFormat: displayCardPageFormat,
      margin: pw.EdgeInsets.zero,
      build: (context) => pw.Image(image, fit: pw.BoxFit.fill),
    ),
  );
  return doc.save();
}

/// The card on screen with a print button. What is printed is the card as it
/// is drawn here, captured at print resolution, so the two cannot differ.
class DisplayCardView extends StatefulWidget {
  const DisplayCardView({
    super.key,
    required this.input,
    this.print = printPdfDocument,
  });

  final DisplayCardInput input;

  /// Replaced in tests; the platform's print dialog is not there to talk to.
  final PrintPdf print;

  @override
  State<DisplayCardView> createState() => _DisplayCardViewState();
}

class _DisplayCardViewState extends State<DisplayCardView> {
  final _card = GlobalKey();
  bool _busy = false;

  /// Width of the captured picture: about 410 dpi across 148 mm.
  static const _printPixels = 2400.0;

  Future<void> _print() async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final boundary =
          _card.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(
        pixelRatio: _printPixels / boundary.size.width,
      );
      final pdf = await displayCardPdf(image);
      await widget.print(
        pdf,
        'GalleryZone-display-card-${widget.input.artworkCode}',
        displayCardPageFormat,
      );
    } catch (error) {
      messenger.showSnackBar(
        const SnackBar(content: Text("Couldn't prepare the display card.")),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ZoomablePaper(
          title: 'Display card',
          enlarged: DisplayCard(input: widget.input),
          child: RepaintBoundary(
            key: _card,
            child: DisplayCard(input: widget.input),
          ),
        ),
        const SizedBox(height: 16),
        Center(
          child: OutlinedButton.icon(
            onPressed: _busy ? null : _print,
            icon: _busy
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(LucideIcons.printer, size: 14),
            label: const Text('Print display card'),
            style: paperButtonStyle(theme),
          ),
        ),
      ],
    );
  }
}
