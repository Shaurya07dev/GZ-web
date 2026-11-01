import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../../core/launch.dart';
import '../../../core/motion.dart';
import '../../../core/nfc/ntag213.dart' show formatTagUid;
import '../../../core/theme/app_theme.dart';
import '../../../core/verify_url.dart';
import '../../../data/models/artwork.dart';
import '../../../data/models/nfc.dart';
import '../../auth/providers/auth_providers.dart';
import '../../coa/paper_view.dart';
import '../../marketplace/screens/passport_screen.dart' show PassportBody;
import '../../marketplace/widgets/artwork_card.dart';
import '../../nfc/providers/nfc_providers.dart';
import '../../nfc/widgets/nfc_sheets.dart';
import '../../ownership/providers/ownership_providers.dart';
import '../../ownership/widgets/transfer_widgets.dart';
import '../providers/artist_providers.dart';
import '../widgets/artist_widgets.dart';
import '../widgets/artwork_history.dart';

/// Port of `features/dashboard/coa-nfc-board.tsx`. Every submitted artwork
/// gets a Certificate of Authenticity; physical pieces also carry an NFC/QR
/// tag that resolves to the same passport a collector scans.
class CoaNfcScreen extends ConsumerWidget {
  const CoaNfcScreen({super.key});

  static const path = '/dashboard/coa-nfc';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final artworks = ref.watch(artistArtworksProvider);
    // A phone without NFC can't write or lock a tag; it doesn't see the buttons.
    final hasNfc = ref.watch(nfcAvailableProvider).value ?? true;

    return Scaffold(
      appBar: AppBar(title: const Text('COA & NFC')),
      body: artworks.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.triangleAlert,
          title: "Couldn't load your certificates",
          description: 'Something went wrong. Try again in a moment.',
          action: OutlinedButton(
            onPressed: () => ref.invalidate(artistArtworksProvider),
            child: const Text('Try again'),
          ),
        ),
        data: (list) => RefreshIndicator.adaptive(
          onRefresh: () async {
            ref.invalidate(artistArtworksProvider);
            ref.invalidate(artistPhysicalCoaProvider);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              ContentWidth(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Certificates & tags',
                      style: theme.textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Every submitted artwork gets a Certificate of Authenticity; physical pieces also get an '
                      'NFC/QR tag linked to it.',
                      style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                    ),
                    const SizedBox(height: 16),
                    if (!hasNfc) ...[
                      const _Banner(
                        key: Key('nfc-unavailable'),
                        icon: LucideIcons.nfc,
                        text: 'This phone has no NFC, or it is switched off, so tags can’t be linked or locked here.',
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (list.any((entry) => entry.artwork.nfcNeedsLock)) ...[
                      _Banner(
                        key: const Key('nfc-lock-warning'),
                        icon: LucideIcons.triangleAlert,
                        danger: true,
                        text: _unlockedSentence(
                          list
                              .where((entry) => entry.artwork.nfcNeedsLock)
                              .length,
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    const PhysicalCoaQueue(),
                    if (list.isEmpty)
                      const EmptyState(
                        icon: LucideIcons.fingerprint,
                        title: 'No certificates yet',
                        description: 'Submit an artwork to generate its first certificate.',
                      )
                    else
                      for (final entry in list)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _CertificateRow(
                            artwork: entry.artwork,
                            hasNfc: hasNfc,
                          ),
                        ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _unlockedSentence(int count) =>
    '${count == 1 ? '1 piece has' : '$count pieces have'} a tag that isn’t locked. Lock '
    '${count == 1 ? 'it' : 'each one'}: a piece can’t be dispatched to a buyer or a gallery until its tag is locked.';

class _Banner extends StatelessWidget {
  const _Banner({
    super.key,
    required this.icon,
    required this.text,
    this.danger = false,
  });

  final IconData icon;
  final String text;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = danger
        ? theme.colorScheme.error
        : theme.textTheme.bodySmall?.color ?? theme.colorScheme.outline;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: theme.textTheme.bodySmall?.copyWith(height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}

/// One line of what is on a tag: a label, its value, and a copy button that
/// turns into a tick once copied. A value with [onOpen] opens when tapped.
class _TagFact extends StatefulWidget {
  const _TagFact({
    super.key,
    required this.label,
    required this.value,
    required this.copyText,
    this.onOpen,
  });

  final String label;
  final String value;
  final String copyText;
  final VoidCallback? onOpen;

  @override
  State<_TagFact> createState() => _TagFactState();
}

class _TagFactState extends State<_TagFact> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.copyText));
    if (!mounted) return;
    setState(() => _copied = true);
    await Future<void>.delayed(const Duration(milliseconds: 1600));
    if (mounted) setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final value = Text(
      widget.value,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: TextAlign.right,
      style: theme.textTheme.bodySmall?.copyWith(
        color: widget.onOpen == null
            ? theme.colorScheme.onSurface
            : theme.colorScheme.tertiary,
        fontWeight: FontWeight.w500,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
    return Row(
      children: [
        Text(widget.label, style: theme.textTheme.bodySmall),
        const SizedBox(width: 12),
        Expanded(
          child: widget.onOpen == null
              ? value
              : InkWell(
                  onTap: widget.onOpen,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: value,
                  ),
                ),
        ),
        IconButton(
          onPressed: _copy,
          visualDensity: VisualDensity.compact,
          iconSize: 15,
          tooltip: 'Copy ${widget.label.toLowerCase()}',
          icon: Icon(
            _copied ? LucideIcons.check : LucideIcons.copy,
            color: _copied
                ? theme.colorScheme.tertiary
                : theme.colorScheme.outline,
          ),
        ),
      ],
    );
  }
}

class _CertificateRow extends ConsumerWidget {
  const _CertificateRow({required this.artwork, required this.hasNfc});

  final Artwork artwork;
  final bool hasNfc;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final stage = artwork.nfcStage;
    final tagged = stage != NfcStage.unlinked;

    void refresh() {
      ref.invalidate(artistArtworksProvider);
      ref.invalidate(passportProvider(artwork.id));
    }

    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: ArtworkImageView(url: artwork.thumbnailUrl),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      artwork.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      artwork.coaCertificateNumber.isEmpty
                          ? 'Certificate pending'
                          : artwork.coaCertificateNumber,
                      style: theme.textTheme.labelSmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _NfcPill(stage: stage),
            ],
          ),
          if (stage == NfcStage.linkedUnlocked) ...[
            const SizedBox(height: 10),
            _MustLock(key: Key('nfc-must-lock-${artwork.id}')),
          ],
          if (tagged) ...[
            const SizedBox(height: 6),
            // What is on the tag: the link it opens when tapped (the same one
            // the QR carries) and the chip's own ID. The ID is the artist's to
            // see; the public passport never shows it.
            _TagFact(
              key: Key('tag-link-${artwork.id}'),
              label: 'Link on the tag',
              value: verifyUrlFor(artwork.id)
                  .replaceFirst(RegExp(r'^https?://'), ''),
              copyText: verifyUrlFor(artwork.id),
              onOpen: () => openExternal(context, verifyUrlFor(artwork.id)),
            ),
            if (artwork.nfcTagUid case final uid? when uid.isNotEmpty)
              _TagFact(
                key: Key('tag-chip-id-${artwork.id}'),
                label: 'Chip ID',
                value: formatTagUid(uid),
                copyText: formatTagUid(uid),
              ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (hasNfc && stage == NfcStage.linkedUnlocked)
                FilledButton.icon(
                  key: Key('lock-nfc-${artwork.id}'),
                  onPressed: () => showNfcSheet(
                    context,
                    artwork: artwork,
                    mode: NfcMode.lock,
                    onChanged: refresh,
                  ),
                  icon: const Icon(LucideIcons.lock, size: 14),
                  label: const Text('Lock tag'),
                ),
              if (hasNfc && stage != NfcStage.linkedLocked)
                OutlinedButton.icon(
                  key: Key('link-nfc-${artwork.id}'),
                  onPressed: () => showNfcSheet(
                    context,
                    artwork: artwork,
                    mode: NfcMode.link,
                    onChanged: refresh,
                  ),
                  icon: Icon(
                    LucideIcons.link2,
                    size: 14,
                    color: theme.colorScheme.tertiary,
                  ),
                  label: Text(
                    stage == NfcStage.unlinked ? 'Link tag' : 'Replace tag',
                  ),
                ),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    fullscreenDialog: true,
                    builder: (_) => CertificatePreviewScreen(artwork: artwork),
                  ),
                ),
                icon: Icon(
                  LucideIcons.badgeCheck,
                  size: 14,
                  color: theme.colorScheme.tertiary,
                ),
                label: const Text('Preview certificate'),
              ),
              OutlinedButton.icon(
                key: Key('display-card-${artwork.id}'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    fullscreenDialog: true,
                    builder: (_) => CertificatePreviewScreen(
                      artwork: artwork,
                      initialTab: PaperTab.card,
                    ),
                  ),
                ),
                icon: Icon(
                  LucideIcons.tag,
                  size: 14,
                  color: theme.colorScheme.tertiary,
                ),
                label: const Text('Display card'),
              ),
              // History answers a different question from the certificate -
              // where the piece has been, not whether it is genuine - so it
              // gets its own way in.
              OutlinedButton.icon(
                onPressed: () => _showHistory(context, artwork),
                icon: Icon(
                  LucideIcons.history,
                  size: 14,
                  color: theme.colorScheme.tertiary,
                ),
                label: const Text('History'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

Future<void> _showHistory(BuildContext context, Artwork artwork) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (context) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      builder: (context, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
        children: [
          Text('History', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 2),
          Text(artwork.title, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 16),
          ArtworkHistoryView(artwork: artwork),
        ],
      ),
    ),
  );
}

/// Three states, not two (NFC_IMPLEMENTATION.md §3). "Linked, unlocked" is
/// deliberately not the gold of a finished tag: the piece cannot ship in it.
class _NfcPill extends StatelessWidget {
  const _NfcPill({required this.stage});

  final NfcStage stage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final locked = stage == NfcStage.linkedLocked;
    final unlocked = stage == NfcStage.linkedUnlocked;
    const amber = Color(0xFFD9A441);
    final color = locked
        ? theme.colorScheme.tertiary
        : (unlocked ? amber : theme.textTheme.bodySmall?.color);
    return Flexible(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: locked
              ? theme.colorScheme.primary.withValues(alpha: 0.1)
              : (unlocked
                    ? amber.withValues(alpha: 0.1)
                    : theme.colorScheme.secondary),
          border: Border.all(
            color: locked
                ? theme.colorScheme.primary.withValues(alpha: 0.4)
                : (unlocked
                      ? amber.withValues(alpha: 0.4)
                      : theme.colorScheme.outline),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              locked
                  ? LucideIcons.lock
                  : (unlocked ? LucideIcons.shieldCheck : LucideIcons.scanLine),
              size: 12,
              color: color,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                nfcStageLabel(stage),
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The red flag on a tag that was written but never locked.
class _MustLock extends StatelessWidget {
  const _MustLock({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = theme.colorScheme.error;
    return Row(
      children: [
        Icon(LucideIcons.triangleAlert, size: 13, color: color),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            'Must lock before shipping',
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

/// The artist's certificate and display card for one piece, together: the
/// Certificate of Authenticity as it is printed, the "FOR SALE" card that
/// travels with the piece, and the artist's one extra control: the first
/// hand-over of the piece, from artist to buyer. The buyer can pass it on again
/// later from their own collection. The full passport, as a collector sees it,
/// is one tap away.
class CertificatePreviewScreen extends ConsumerWidget {
  const CertificatePreviewScreen({
    super.key,
    required this.artwork,
    this.initialTab = PaperTab.certificate,
  });

  final Artwork artwork;
  final PaperTab initialTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final passport = ref.watch(passportProvider(artwork.id));
    final me = ref.watch(accountProvider).value;

    return Scaffold(
      appBar: AppBar(title: const Text('Certificate & display card')),
      body: passport.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.triangleAlert,
          title: "The passport didn't load",
          description: 'Check your connection and try again.',
          action: OutlinedButton(
            onPressed: () => ref.invalidate(passportProvider(artwork.id)),
            child: const Text('Try again'),
          ),
        ),
        data: (data) => ContentWidth(
          maxWidth: 620,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              ArtworkPaper(
                artwork: artwork,
                passport: data,
                ownerName: data?.ownerName ?? '',
                initialTab: initialTab,
              ),
              const SizedBox(height: 28),
              Center(
                child: TextButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => Scaffold(
                        appBar: AppBar(title: const Text('Artwork passport')),
                        body: PassportBody(artwork: artwork, passport: data),
                      ),
                    ),
                  ),
                  icon: const Icon(LucideIcons.scrollText, size: 14),
                  label: const Text('View full passport'),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: OutlinedButton.icon(
            onPressed: () => showTransferOwnershipSheet(
              context,
              ref,
              artwork: artwork,
              fromName:
                  resolveCustody(artwork).legalOwnerName ?? me?.name ?? '',
            ),
            icon: const Icon(LucideIcons.userRoundCheck, size: 14),
            label: const Text('Transfer rights'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ),
      ),
    );
  }
}

/// Paper-certificate requests from collectors (MOU §12). The artist prints and
/// signs their own, and this records that it went out, which is the part the
/// collector needs to see.
class PhysicalCoaQueue extends ConsumerWidget {
  const PhysicalCoaQueue({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final requests = ref.watch(artistPhysicalCoaProvider).value ?? const [];
    if (requests.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Paper certificate requests', style: theme.textTheme.titleLarge),
        const SizedBox(height: 8),
        for (final request in requests)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: PortalCard(
              gold: request.status == PhysicalCoaStatus.requested,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    request.artworkTitle,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  PortalDetailRow(
                    label: 'Certificate',
                    value: request.coaCertificateNumber,
                  ),
                  PortalDetailRow(
                    label: 'Requested by',
                    value: request.requestedByName,
                  ),
                  PortalDetailRow(
                    label: 'Post to',
                    value: request.deliveryAddress,
                  ),
                  if (request.status == PhysicalCoaStatus.dispatched)
                    PortalDetailRow(
                      label: 'Dispatched',
                      value:
                          '${formatLongDate(request.dispatchedAt!)} · ${request.courierRef}',
                      gold: true,
                    )
                  else
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () =>
                            _showDispatchSheet(context, ref, request.id),
                        icon: const Icon(LucideIcons.package, size: 14),
                        label: const Text('Mark dispatched'),
                        style: TextButton.styleFrom(padding: EdgeInsets.zero),
                      ),
                    ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
      ],
    );
  }
}

Future<void> _showDispatchSheet(
  BuildContext context,
  WidgetRef ref,
  String requestId,
) {
  final courier = TextEditingController();
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Dispatch certificate',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: courier,
            decoration: const InputDecoration(
              labelText: 'Courier reference',
              helperText: 'Whatever the collector can track it with.',
            ),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(context);
              try {
                await ref
                    .read(artistRepositoryProvider)
                    .dispatchPhysicalCoa(requestId, courier.text);
                ref.invalidate(artistPhysicalCoaProvider);
                ref.invalidate(artistActivityProvider);
                navigator.pop();
              } catch (error) {
                messenger.showSnackBar(
                  SnackBar(content: Text(authErrorMessage(error))),
                );
              }
            },
            child: const Text('Mark dispatched'),
          ),
        ],
      ),
    ),
  );
}
