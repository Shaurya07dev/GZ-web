import 'package:flutter/material.dart';

import '../../core/motion.dart';
import '../../core/theme/app_theme.dart';
import '../../data/models/artwork.dart';
import '../../data/models/passport.dart';
import 'coa_certificate.dart';
import 'coa_inputs.dart';
import 'display_card_view.dart';
import 'download_coa_button.dart';
import 'zoomable_paper.dart';

/// The two printed papers that travel with a piece.
enum PaperTab { certificate, card }

/// The Certificate of Authenticity and the "FOR SALE" display card for one
/// piece, in one place: the certificate as it is printed with its download, and
/// the card with its print. The app's equivalent of the website's
/// certificate dialog, so the card is "with the COA itself".
class ArtworkPaper extends StatefulWidget {
  const ArtworkPaper({
    super.key,
    required this.artwork,
    required this.passport,
    this.ownerName = '',
    this.initialTab = PaperTab.certificate,
    this.share = shareCoaPdf,
    this.print = printPdfDocument,
  });

  final Artwork artwork;
  final Passport? passport;
  final String ownerName;
  final PaperTab initialTab;

  /// Replaced in tests; the platform's share sheet and print dialog are not
  /// there to talk to.
  final SharePdf share;
  final PrintPdf print;

  @override
  State<ArtworkPaper> createState() => _ArtworkPaperState();
}

class _ArtworkPaperState extends State<ArtworkPaper> {
  late PaperTab _tab = widget.initialTab;

  @override
  Widget build(BuildContext context) {
    final certificate = coaInputFor(
      widget.artwork,
      widget.passport,
      ownerName: widget.ownerName,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: _PaperTabs(
            tab: _tab,
            onChanged: (tab) => setState(() => _tab = tab),
          ),
        ),
        const SizedBox(height: 16),
        BranchFade(
          index: _tab.index,
          child: switch (_tab) {
            PaperTab.certificate => Column(
              key: const Key('paper-certificate'),
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ZoomablePaper(
                  title: 'Certificate of Authenticity',
                  child: CoaCertificate(input: certificate),
                ),
                const SizedBox(height: 16),
                Center(
                  child: DownloadCoaButton(
                    certificate: certificate,
                    share: widget.share,
                  ),
                ),
              ],
            ),
            PaperTab.card => DisplayCardView(
              key: const Key('paper-card'),
              input: displayCardInputFor(widget.artwork, widget.passport),
              print: widget.print,
            ),
          },
        ),
      ],
    );
  }
}

/// "Certificate | Display card", as a pill with the chosen side filled in gold.
class _PaperTabs extends StatelessWidget {
  const _PaperTabs({required this.tab, required this.onChanged});

  final PaperTab tab;
  final ValueChanged<PaperTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget item(PaperTab value, String label) {
      final selected = value == tab;
      return Semantics(
        button: true,
        selected: selected,
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: AppMotion.fast,
            curve: AppMotion.standard,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              color: selected
                  ? theme.colorScheme.primary.withValues(alpha: 0.2)
                  : Colors.transparent,
            ),
            child: Text(
              label,
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w500,
                color: selected
                    ? theme.colorScheme.tertiary
                    : theme.textTheme.bodySmall?.color,
              ),
            ),
          ),
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: theme.colorScheme.outline),
      ),
      child: Padding(
        padding: const EdgeInsets.all(2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            item(PaperTab.certificate, 'Certificate'),
            item(PaperTab.card, 'Display card'),
          ],
        ),
      ),
    );
  }
}
