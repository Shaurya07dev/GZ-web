import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/format.dart';
import '../../../core/launch.dart';
import '../../../data/models/artwork.dart';
import '../../auth/providers/auth_providers.dart';
import '../../shell/portal_widgets.dart';
import '../providers/ownership_providers.dart';

/// The link a buyer opens to accept ownership. A real deployment serves this
/// from the deep-link domain (an open decision); until that is settled the
/// same path works inside the app, and the copyable string is honest about
/// what it is.
String transferLink(String transferId) =>
    '$galleryZoneSite/transfer/$transferId';

/// Hands a piece to a named buyer.
///
/// Ownership does not move here — this only opens the transfer. The record
/// changes when the recipient accepts, which is the whole point: a passport
/// that could be reassigned unilaterally would be worth nothing.
Future<void> showTransferOwnershipSheet(
  BuildContext context,
  WidgetRef ref, {
  required Artwork artwork,
  required String fromName,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _TransferSheet(artwork: artwork, fromName: fromName),
  );
}

class _TransferSheet extends ConsumerStatefulWidget {
  const _TransferSheet({required this.artwork, required this.fromName});

  final Artwork artwork;
  final String fromName;

  @override
  ConsumerState<_TransferSheet> createState() => _TransferSheetState();
}

class _TransferSheetState extends ConsumerState<_TransferSheet> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _price = TextEditingController();
  bool _busy = false;
  OwnershipTransfer? _created;
  TransferKind _kind = TransferKind.ownership;
  DateTime? _displayStartsAt;
  DateTime? _displayEndsAt;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _displayStartsAt = DateTime(now.year, now.month, now.day);
    _price.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _price.dispose();
    super.dispose();
  }

  int? _givingPricePaise() {
    final value = double.tryParse(_price.text.trim());
    if (value == null || value <= 0) return null;
    return (value * 100).round();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_kind == TransferKind.display &&
        (_displayStartsAt == null || _displayEndsAt == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Pick the dates the display runs from and to'),
        ),
      );
      return;
    }
    if (_kind == TransferKind.display &&
        !_displayEndsAt!.isAfter(_displayStartsAt!)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('The display end date must be after its start date'),
        ),
      );
      return;
    }
    if (_kind == TransferKind.ownership && _givingPricePaise() == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter the price this piece is changing hands at'),
        ),
      );
      return;
    }
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final transfer = await ref
          .read(ownershipRepositoryProvider)
          .initiate(
            artworkId: widget.artwork.id,
            fromName: widget.fromName,
            toName: _name.text,
            toEmail: _email.text,
            kind: _kind,
            displayStartsAt: _displayStartsAt?.toIso8601String(),
            displayEndsAt: _displayEndsAt?.toIso8601String(),
            givingPricePaise:
                _kind == TransferKind.ownership ? _givingPricePaise() : null,
          );
      ref.invalidate(artworkTransfersProvider(widget.artwork.id));
      if (!mounted) return;
      setState(() => _created = transfer);
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(authErrorMessage(error))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final created = _created;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 28,
      ),
      child: SingleChildScrollView(
        child: created != null
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    LucideIcons.send,
                    size: 32,
                    color: theme.colorScheme.tertiary,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _kind == TransferKind.display
                        ? 'Display transfer opened'
                        : 'Transfer opened',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _kind == TransferKind.display
                        ? 'Send this link to ${created.toName}. You stay the owner '
                              'throughout. The display period runs from '
                              '${formatLongDate(created.displayStartsAt ?? created.initiatedAt)} '
                              'to ${formatLongDate(created.displayEndsAt!)}.'
                        : 'Send this link to ${created.toName}. "${widget.artwork.title}" stays '
                              'yours until they accept it.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                  ),
                  const SizedBox(height: 16),
                  SelectableText(
                    transferLink(created.id),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.labelSmall?.copyWith(
                      fontFamily: 'monospace',
                      color: theme.colorScheme.tertiary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(
                        ClipboardData(text: transferLink(created.id)),
                      );
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Link copied')),
                      );
                    },
                    icon: const Icon(LucideIcons.copy, size: 14),
                    label: const Text('Copy link'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Done'),
                  ),
                ],
              )
            : Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Transfer rights', style: theme.textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(
                      'Hand over "${widget.artwork.title}" — either its ownership '
                      'record, or display rights for a fixed period. Either way '
                      'the passport only changes when they accept.',
                      style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                    ),
                    const SizedBox(height: 14),
                    SegmentedButton<TransferKind>(
                      segments: [
                        for (final kind in TransferKind.values)
                          ButtonSegment(
                            value: kind,
                            label: Text(transferKindLabel[kind]!),
                          ),
                      ],
                      selected: {_kind},
                      onSelectionChanged: (selection) =>
                          setState(() => _kind = selection.first),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _kind == TransferKind.ownership
                          ? 'Permanent. The piece changes hands.'
                          : 'Runs between two dates. You stay the owner.',
                      style: theme.textTheme.labelSmall,
                    ),
                    if (_kind == TransferKind.display) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () async {
                          final now = DateTime.now();
                          final picked = await showDatePicker(
                            context: context,
                            firstDate: DateTime(now.year, now.month, now.day),
                            lastDate: now.add(const Duration(days: 365)),
                            initialDate: _displayStartsAt ?? now,
                          );
                          if (picked != null) {
                            setState(() {
                              _displayStartsAt = picked;
                              if (_displayEndsAt != null &&
                                  !_displayEndsAt!.isAfter(picked)) {
                                _displayEndsAt = null;
                              }
                            });
                          }
                        },
                        icon: const Icon(LucideIcons.calendar, size: 15),
                        label: Text(
                          _displayStartsAt == null
                              ? 'On display from…'
                              : 'On display from ${formatShortDate(_displayStartsAt!.toIso8601String())}',
                        ),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () async {
                          final now = DateTime.now();
                          final start =
                              _displayStartsAt ??
                              DateTime(now.year, now.month, now.day);
                          final firstEnd = start.add(const Duration(days: 1));
                          final picked = await showDatePicker(
                            context: context,
                            firstDate: firstEnd,
                            lastDate: now.add(const Duration(days: 730)),
                            initialDate:
                                _displayEndsAt ??
                                start.add(const Duration(days: 30)),
                          );
                          if (picked != null) {
                            setState(() => _displayEndsAt = picked);
                          }
                        },
                        icon: const Icon(LucideIcons.calendarCheck, size: 15),
                        label: Text(
                          _displayEndsAt == null
                              ? 'On display until…'
                              : 'On display until ${formatShortDate(_displayEndsAt!.toIso8601String())}',
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'The display ends on its own that day. You can also end '
                        'it early from the passport.',
                        style: theme.textTheme.labelSmall,
                      ),
                    ],
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _name,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      validator: (value) => (value ?? '').trim().isEmpty
                          ? "Enter the new owner's name"
                          : null,
                      decoration: InputDecoration(
                        labelText: _kind == TransferKind.display
                            ? 'Who is displaying it'
                            : "New owner's name",
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      validator: (value) =>
                          RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                              .hasMatch((value ?? '').trim())
                          ? null
                          : 'Enter a valid email address',
                      decoration: InputDecoration(
                        labelText: _kind == TransferKind.display
                            ? 'Their email'
                            : "New owner's email",
                      ),
                    ),
                    if (_kind == TransferKind.ownership) ...[
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _price,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        autovalidateMode: AutovalidateMode.onUserInteraction,
                        validator: (value) {
                          final v = double.tryParse((value ?? '').trim());
                          if (v == null || v <= 0) {
                            return 'Enter the price this piece is changing hands at';
                          }
                          return null;
                        },
                        decoration: const InputDecoration(
                          labelText: 'Changing hands at (₹)',
                          hintText: '85000',
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'The piece itself is settled off GalleryZone. '
                        'GalleryZone charges a 5% fee on this price (with GST) — '
                        '2% artist royalty, 3% platform.',
                        style: theme.textTheme.labelSmall,
                      ),
                      if (_givingPricePaise() != null) ...[
                        const SizedBox(height: 10),
                        _FeePreview(givingPricePaise: _givingPricePaise()!),
                      ],
                    ],
                    const SizedBox(height: 18),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: Text(
                        _busy
                            ? 'Opening…'
                            : _kind == TransferKind.display
                            ? 'Send display transfer'
                            : 'Send transfer',
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

/// The chain of custody, on the passport. Empty until a piece changes hands,
/// which is the truthful state — the artist made it and nobody has handed it
/// on yet.
class OwnershipHistory extends ConsumerWidget {
  const OwnershipHistory({
    super.key,
    required this.artworkId,
    required this.artistName,
  });

  final String artworkId;
  final String artistName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final transfers =
        ref.watch(artworkTransfersProvider(artworkId)).value ?? const [];
    final accepted = transfers
        .where((t) => t.status == TransferStatus.accepted)
        .toList();
    final pending = transfers
        .where((t) => t.status == TransferStatus.pending)
        .toList();
    final onDisplay = activeDisplayTransfer(transfers);
    // The passport is public. Ending a display early is the owner's call, so
    // the control only appears for someone signed in — there is no real auth
    // behind any of this yet.
    final signedIn = ref.watch(sessionProvider) != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Ownership', style: theme.textTheme.titleLarge),
        const SizedBox(height: 10),
        if (onDisplay != null) ...[
          PortalCard(
            gold: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      LucideIcons.frame,
                      size: 16,
                      color: theme.colorScheme.tertiary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'On display with ${onDisplay.toName}',
                        style: theme.textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${_displayRange(onDisplay)}. Ownership is '
                  'unchanged — display rights end on that date on their own.',
                  style: theme.textTheme.labelSmall,
                ),
                if (signedIn) ...[
                  const SizedBox(height: 10),
                  OutlinedButton(
                    onPressed: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      try {
                        await ref
                            .read(ownershipRepositoryProvider)
                            .endDisplay(onDisplay.id);
                        ref.invalidate(artworkTransfersProvider(artworkId));
                      } catch (error) {
                        messenger.showSnackBar(
                          SnackBar(content: Text(authErrorMessage(error))),
                        );
                      }
                    },
                    child: const Text('End display now'),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
        PortalCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Line(label: 'Created by', value: artistName, gold: true),
              for (final transfer in accepted.reversed)
                _Line(
                  label: transferKindOf(transfer) == TransferKind.display
                      ? 'Display rights to'
                      : 'Transferred to',
                  value: transferKindOf(transfer) == TransferKind.display
                      ? '${transfer.toName} · ${_displayLabel(transfer)}'
                      : '${transfer.toName} · ${formatLongDate(transfer.acceptedAt!)}',
                ),
              if (pending.isNotEmpty)
                _Line(
                  label: 'Awaiting acceptance',
                  value: pending.first.toName,
                  muted: true,
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Display rights are loans, not sales — they never change the owner.',
          style: theme.textTheme.labelSmall,
        ),
      ],
    );
  }
}

String _displayLabel(OwnershipTransfer transfer) {
  if (isDisplayActive(transfer)) {
    return _displayRange(transfer).toLowerCase();
  }
  final endedOn = transfer.displayEndedAt ?? transfer.displayEndsAt;
  return endedOn == null ? 'display ended' : 'ended ${formatLongDate(endedOn)}';
}

String _displayRange(OwnershipTransfer transfer) {
  final startsAt =
      transfer.displayStartsAt ?? transfer.acceptedAt ?? transfer.initiatedAt;
  return 'From ${formatLongDate(startsAt)} to ${formatLongDate(transfer.displayEndsAt!)}';
}

class _Line extends StatelessWidget {
  const _Line({
    required this.label,
    required this.value,
    this.gold = false,
    this.muted = false,
  });

  final String label;
  final String value;
  final bool gold;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            muted ? LucideIcons.clock3 : LucideIcons.arrowRight,
            size: 13,
            color: muted
                ? theme.colorScheme.outline
                : theme.colorScheme.tertiary,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: theme.textTheme.labelSmall),
                Text(
                  value,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: gold ? FontWeight.w600 : FontWeight.w400,
                    color: gold ? theme.colorScheme.tertiary : null,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeePreview extends StatelessWidget {
  const _FeePreview({required this.givingPricePaise});

  final int givingPricePaise;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final royalty = (givingPricePaise * 0.02).round();
    final platform = (givingPricePaise * 0.03).round();
    final gst = ((royalty + platform) * 0.18).round();
    final total = royalty + platform + gst;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colorScheme.tertiary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: theme.colorScheme.tertiary.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        children: [
          _FeeRow(label: 'Artist royalty (2%)', value: royalty),
          _FeeRow(label: 'GalleryZone (3%)', value: platform),
          _FeeRow(label: 'GST on the fee (18%)', value: gst),
          const Divider(height: 14),
          _FeeRow(label: 'You will pay to GalleryZone', value: total, bold: true),
        ],
      ),
    );
  }
}

class _FeeRow extends StatelessWidget {
  const _FeeRow({required this.label, required this.value, this.bold = false});

  final String label;
  final int value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
        Text(
          formatInr(value / 100),
          style: theme.textTheme.bodySmall?.copyWith(
            fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ],
    );
  }
}
