import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/verify_url.dart';

/// The "FOR SALE" display card that travels with a piece (artist MOU 8.2 and
/// 13.1d): artwork details on the left, a QR to the live passport on the right.
/// A port of the website's DisplayCard, drawn from the same design.
///
/// Every length is in card-width units: 100 units is the card's width and its
/// height is 63, so the card scales as one piece, from a phone screen to the
/// 148 x 93 mm print.
class DisplayCardInput {
  const DisplayCardInput({
    required this.artworkId,
    required this.title,
    required this.description,
    required this.artForm,
    required this.medium,
    required this.size,
    required this.artworkCode,
    required this.artistName,
  });

  final String artworkId;
  final String title;
  final String description;

  /// The regional tradition when known, else the category.
  final String artForm;
  final String medium;
  final String size;

  /// The artwork's code (GZ000045), not its database id.
  final String artworkCode;
  final String artistName;
}

const _gold = Color(0xFFD9A21B);
const _iconGold = Color(0xFFE8B923);
const _red = Color(0xFFD70000);

/// The card's aspect: 1000 x 630.
const displayCardAspect = 1000 / 630;

// --- Fitting text into the card's fixed slots -----------------------------------------------------------
// The card is a fixed size, so long values have to give way somewhere. The rule: shrink the type first, down to
// a floor that is still readable on a 148 mm card, and only then cut, always at a word boundary and with an
// ellipsis, never mid-word or silently.

String _collapse(String text) => text.replaceAll(RegExp(r'\s+'), ' ').trim();

/// Cuts [text] to at most [max] characters at a word boundary, with an ellipsis.
String cutAtWord(String text, int max) {
  if (text.length <= max) return text;
  final cut = text
      .substring(0, max)
      .replaceFirst(RegExp(r'\s+\S*$'), '')
      .replaceFirst(RegExp(r'[\s,;:.\-–]+$'), '');
  return '$cut…';
}

/// A one-line value: short ones at full size, longer ones a step down and
/// allowed to wrap to two lines, then cut at a word.
({double size, String text}) lineFit(String text) => (
  size: text.length <= 24 ? 2.0 : 1.75,
  text: cutAtWord(text, 56),
);

/// Description type sizes, largest first. 1.55 units is about 6.5 pt on the
/// printed card, the floor for reading it.
const descriptionSizes = [2.0, 1.85, 1.7, 1.55];

/// The description wraps over three lines. It takes the largest size whose text
/// fits them, and only if even the smallest does not fit is the text cut, at a
/// word boundary, until it does. [fits] answers whether a text at a size (in
/// card units) fits the three lines.
({double size, String text}) fitDescription(
  String text,
  bool Function(String text, double size) fits,
) {
  final full = _collapse(text);
  var size = descriptionSizes.last;
  for (final candidate in descriptionSizes) {
    if (fits(full, candidate)) {
      size = candidate;
      break;
    }
  }
  var shown = full;
  var n = full.length;
  while (!fits(shown, size) && n > 12) {
    n = (n * 0.94).floor();
    shown = cutAtWord(full, n);
  }
  return (size: size, text: shown);
}

class DisplayCard extends StatelessWidget {
  const DisplayCard({super.key, required this.input});

  final DisplayCardInput input;

  @override
  Widget build(BuildContext context) {
    final url = verifyUrlFor(input.artworkId);
    // A fixed artwork, like the printed card: the phone's text-size setting
    // must not reflow it.
    return MediaQuery.withNoTextScaling(
      child: AspectRatio(
      aspectRatio: displayCardAspect,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final u = constraints.maxWidth / 100;
          return DefaultTextStyle(
            style: const TextStyle(
              fontFamily: 'Inter',
              color: Colors.black,
              fontWeight: FontWeight.w400,
              decoration: TextDecoration.none,
            ),
            child: ClipRect(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Positioned.fill(child: ColoredBox(color: Colors.white)),
                  // White panel, black panel with its curved gold edge, and the gold frame.
                  const Positioned.fill(
                    child: CustomPaint(painter: _CardFramePainter()),
                  ),

                  // Brand
                  Positioned(
                    left: 2.4 * u,
                    top: -0.9 * u,
                    width: 17.4 * u,
                    child: Image.asset(
                      'assets/brand/gz-logo.png',
                      semanticLabel: 'GalleryZone',
                      filterQuality: FilterQuality.medium,
                    ),
                  ),
                  Positioned(
                    left: 21.4 * u,
                    top: 2.6 * u,
                    width: 36 * u,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Galleryzone',
                          maxLines: 1,
                          style: TextStyle(
                            fontFamily: 'Playfair Display',
                            fontSize: 5.4 * u,
                            height: 1,
                            letterSpacing: -0.01 * 5.4 * u,
                          ),
                        ),
                        SizedBox(height: 0.7 * u),
                        Row(
                          children: [
                            Expanded(child: Container(height: 0.2 * u, color: _gold)),
                            SizedBox(width: 0.8 * u),
                            Transform.rotate(
                              angle: 0.7853981633974483,
                              child: Container(width: 0.9 * u, height: 0.9 * u, color: _gold),
                            ),
                            SizedBox(width: 0.8 * u),
                            Expanded(child: Container(height: 0.2 * u, color: _gold)),
                          ],
                        ),
                        SizedBox(height: 0.8 * u),
                        Text(
                          'art that connects, culture that inspires',
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          style: TextStyle(
                            fontFamily: 'Playfair Display',
                            fontStyle: FontStyle.italic,
                            fontSize: 2.05 * u,
                            height: 1,
                          ),
                        ),
                      ],
                    ),
                  ),

                  Positioned(
                    left: 3.2 * u,
                    top: 12.6 * u,
                    child: _ForSale(size: 10.8 * u),
                  ),

                  // The details. Fixed row heights, so the spacing is identical however long a value is.
                  Positioned(
                    left: 3 * u,
                    top: 24.6 * u,
                    width: 54 * u,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _FieldRow(u: u, icon: LucideIcons.user, label: 'Artwork title', value: input.title),
                        _DetailRow(
                          u: u,
                          icon: LucideIcons.fileText,
                          height: 7.9,
                          child: _FitDescription(u: u, text: input.description),
                        ),
                        _FieldRow(u: u, icon: LucideIcons.flower2, label: 'Art form', value: input.artForm),
                        _FieldRow(u: u, icon: LucideIcons.palette, label: 'Medium', value: input.medium),
                        _FieldRow(u: u, icon: LucideIcons.ruler, label: 'Size', value: input.size),
                        _FieldRow(u: u, icon: LucideIcons.barcode, label: 'Artwork ID', value: input.artworkCode),
                      ],
                    ),
                  ),
                  Positioned(
                    left: 3 * u,
                    width: 51.5 * u,
                    bottom: 1.3 * u,
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: input.artistName,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const TextSpan(text: ': '),
                          const TextSpan(
                            text: 'Artist',
                            style: TextStyle(fontFamily: 'Playfair Display', fontStyle: FontStyle.italic),
                          ),
                        ],
                      ),
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      softWrap: false,
                      style: TextStyle(fontSize: 2.2 * u, height: 1.2),
                    ),
                  ),

                  // Scan panel
                  Positioned(
                    left: 67 * u,
                    top: 8.4 * u,
                    width: 30 * u,
                    child: Row(
                      children: [
                        Expanded(child: Container(height: 0.2 * u, color: _gold)),
                        SizedBox(width: 1 * u),
                        Text(
                          'SCAN TO EXPLORE',
                          maxLines: 1,
                          softWrap: false,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 2 * u,
                            color: _gold,
                            letterSpacing: 0.04 * 2 * u,
                          ),
                        ),
                        SizedBox(width: 1 * u),
                        Expanded(child: Container(height: 0.2 * u, color: _gold)),
                      ],
                    ),
                  ),
                  Positioned(
                    left: 67.4 * u,
                    top: 12.6 * u,
                    width: 29.2 * u,
                    height: 29.2 * u,
                    child: Semantics(
                      image: true,
                      label: 'QR code linking to $url',
                      child: ExcludeSemantics(child: _QrPanel(u: u, url: url)),
                    ),
                  ),
                  Positioned(
                    left: 66.8 * u,
                    top: 47.8 * u,
                    width: 30.4 * u,
                    child: _Pillars(u: u),
                  ),
                  Positioned(
                    left: 66.6 * u,
                    top: 55.6 * u,
                    width: 30.8 * u,
                    child: Text(
                      'Original Art. Timeless Stories.',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      softWrap: false,
                      style: TextStyle(
                        fontFamily: 'Playfair Display',
                        fontStyle: FontStyle.italic,
                        fontSize: 2.35 * u,
                        color: _gold,
                        height: 1.2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
      ),
    );
  }
}

/// The white panel is the card's own background; this draws the black panel
/// with its curved gold edge and the gold frame, in the design's 1000 x 630
/// space.
class _CardFramePainter extends CustomPainter {
  const _CardFramePainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 1000, size.height / 630);
    final panel = Path()
      ..moveTo(650, 0)
      ..lineTo(1000, 0)
      ..lineTo(1000, 630)
      ..lineTo(560, 630)
      ..cubicTo(602, 560, 640, 520, 640, 440)
      ..cubicTo(640, 360, 606, 330, 610, 260)
      ..cubicTo(614, 180, 632, 90, 650, 0)
      ..close();
    canvas.drawPath(panel, Paint()..color = const Color(0xFF050505));
    final edge = Path()
      ..moveTo(650, 0)
      ..cubicTo(632, 90, 614, 180, 610, 260)
      ..cubicTo(606, 330, 640, 360, 640, 440)
      ..cubicTo(640, 520, 602, 560, 560, 630);
    canvas.drawPath(
      edge,
      Paint()
        ..color = _gold
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(4, 4, 992, 622), const Radius.circular(6)),
      Paint()
        ..color = _gold
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8,
    );
  }

  @override
  bool shouldRepaint(_CardFramePainter oldDelegate) => false;
}

/// "FOR SALE" in the design's heaviest weight. The bundled Inter stops at Bold,
/// so the letters are thickened with a thin stroke of the same red.
class _ForSale extends StatelessWidget {
  const _ForSale({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    TextStyle style(Paint? paint) => TextStyle(
      fontFamily: 'Inter',
      fontWeight: FontWeight.w700,
      fontSize: size,
      height: 1,
      letterSpacing: -0.02 * size,
      color: paint == null ? _red : null,
      foreground: paint,
    );
    return Semantics(
      label: 'For sale',
      child: ExcludeSemantics(
        child: Stack(
          children: [
            Text('FOR SALE', maxLines: 1, softWrap: false, style: style(null)),
            Text(
              'FOR SALE',
              maxLines: 1,
              softWrap: false,
              style: style(
                Paint()
                  ..color = _red
                  ..style = PaintingStyle.stroke
                  ..strokeWidth = size * 0.05
                  ..strokeJoin = StrokeJoin.miter,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One detail on the card: a black disc with its icon, the value, and a dotted
/// gold rule under it.
class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.u, required this.icon, required this.child, this.height = 5.3});

  final double u;
  final IconData icon;
  final Widget child;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height * u,
      child: CustomPaint(
        painter: _DottedRule(thickness: 0.22 * u),
        child: Row(
          children: [
            Container(
              width: 4.2 * u,
              height: 4.2 * u,
              decoration: const BoxDecoration(color: Colors.black, shape: BoxShape.circle),
              child: Icon(icon, size: 2.3 * u, color: _iconGold),
            ),
            SizedBox(width: 1.8 * u),
            Expanded(child: Align(alignment: Alignment.centerLeft, child: child)),
          ],
        ),
      ),
    );
  }
}

class _DottedRule extends CustomPainter {
  const _DottedRule({required this.thickness});

  final double thickness;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = _gold;
    final y = size.height - thickness;
    for (var x = 0.0; x < size.width; x += thickness * 2) {
      canvas.drawRect(Rect.fromLTWH(x, y, thickness, thickness), paint);
    }
  }

  @override
  bool shouldRepaint(_DottedRule oldDelegate) => oldDelegate.thickness != thickness;
}

/// A label and a one-line value, with the values lined up in one column.
class _FieldRow extends StatelessWidget {
  const _FieldRow({required this.u, required this.icon, required this.label, required this.value});

  final double u;
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final fit = lineFit(_collapse(value));
    return _DetailRow(
      u: u,
      icon: icon,
      child: Row(
        children: [
          SizedBox(
            width: 18.4 * u,
            child: Text(
              '${label.toUpperCase()}:',
              maxLines: 1,
              softWrap: false,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 2.1 * u,
                height: 1,
                letterSpacing: 0.01 * 2.1 * u,
              ),
            ),
          ),
          SizedBox(width: 1 * u),
          Expanded(
            child: Text(
              fit.text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontWeight: FontWeight.w500, fontSize: fit.size * u, height: 1.15),
            ),
          ),
        ],
      ),
    );
  }
}

/// The description, wrapped over three lines with its label run in on the
/// first. It is measured, not estimated: a short description is large and easy
/// to read, a long one shrinks to fit, and nothing is clipped mid-word.
class _FitDescription extends StatelessWidget {
  const _FitDescription({required this.u, required this.text});

  final double u;
  final String text;

  @override
  Widget build(BuildContext context) {
    // Measured in the very style it is drawn in (the card's Inter), not the
    // default font, or the fit would be judged on the wrong widths.
    final base = DefaultTextStyle.of(context).style;
    return LayoutBuilder(
      builder: (context, constraints) {
        TextSpan span(String body, double size) => TextSpan(
          style: base,
          children: [
            TextSpan(
              text: 'DESCRIPTION: ',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 2.1 * u,
                height: 1.22,
                letterSpacing: 0.01 * 2.1 * u,
              ),
            ),
            TextSpan(
              text: body,
              style: TextStyle(fontWeight: FontWeight.w500, fontSize: size * u, height: 1.22),
            ),
          ],
        );
        bool fits(String body, double size) {
          final painter = TextPainter(
            text: span(body, size),
            textDirection: TextDirection.ltr,
            maxLines: 3,
          )..layout(maxWidth: constraints.maxWidth);
          return !painter.didExceedMaxLines;
        }

        final fit = fitDescription(text, fits);
        return Text.rich(span(fit.text, fit.size), maxLines: 3, overflow: TextOverflow.clip);
      },
    );
  }
}

/// The QR in its gold-ringed white panel, with the GZ seal over its middle.
/// Error correction H: the code can lose 30% and still scan, and the seal
/// covers about a tenth of it.
class _QrPanel extends StatelessWidget {
  const _QrPanel({required this.u, required this.url});

  final double u;
  final String url;

  @override
  Widget build(BuildContext context) {
    const ink = Color(0xFF1A1612);
    return Container(
      padding: EdgeInsets.all(0.5 * u),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(2 * u),
        border: Border.all(color: _gold, width: 0.35 * u),
      ),
      child: Container(
        padding: EdgeInsets.all(1.4 * u),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(1.5 * u)),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned.fill(
              child: QrImageView(
                data: url,
                padding: EdgeInsets.zero,
                backgroundColor: Colors.white,
                errorCorrectionLevel: QrErrorCorrectLevel.H,
                eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: ink),
                dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: ink),
              ),
            ),
            Container(
              width: 8.4 * u,
              height: 8.4 * u,
              decoration: BoxDecoration(
                color: Colors.black,
                shape: BoxShape.circle,
                border: Border.all(color: _gold, width: 0.3 * u),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'GZ',
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      fontWeight: FontWeight.w700,
                      fontSize: 3 * u,
                      height: 1,
                      color: _gold,
                    ),
                  ),
                  SizedBox(height: 0.3 * u),
                  Text(
                    'GALLERYZONE',
                    maxLines: 1,
                    softWrap: false,
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      fontSize: 0.95 * u,
                      height: 1,
                      color: _gold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// DISCOVER | VERIFY | COLLECT, on the black panel.
class _Pillars extends StatelessWidget {
  const _Pillars({required this.u});

  final double u;

  @override
  Widget build(BuildContext context) {
    Widget item(IconData icon, String label) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 2.1 * u, color: _gold),
        SizedBox(width: 0.7 * u),
        Text(
          label,
          maxLines: 1,
          softWrap: false,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 1.22 * u,
            height: 1,
            color: Colors.white,
            letterSpacing: 0.02 * 1.22 * u,
          ),
        ),
      ],
    );
    Widget divider() => Container(
      width: 0.14 * u,
      height: 2.8 * u,
      margin: EdgeInsets.symmetric(horizontal: 0.55 * u),
      color: const Color(0x55FFFFFF),
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        item(LucideIcons.eye, 'DISCOVER'),
        divider(),
        item(LucideIcons.shieldCheck, 'VERIFY'),
        divider(),
        item(LucideIcons.shoppingCart, 'COLLECT'),
      ],
    );
  }
}
