import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../../core/motion.dart';
import '../../../core/payments/payment_gateway.dart';
import '../../../data/models/artwork.dart';
import '../../auth/providers/auth_providers.dart';
import '../../checkout/providers/checkout_providers.dart';
import '../../marketplace/widgets/artwork_card.dart';
import '../../shell/portal_widgets.dart';
import '../providers/ownership_providers.dart';

/// The sender's "pay the 5% fee" screen. Mirrors the web view: price
/// breakdown, open Razorpay, verify through the API. The webhook is the
/// source of truth; this view polls while the transfer is
/// `awaitingPayment` so a webhook win is reflected without a reload.
class TransferPayFeeScreen extends ConsumerStatefulWidget {
  const TransferPayFeeScreen({super.key, required this.transferId});

  static const path = '/account/transfers/:transferId/pay';

  final String transferId;

  @override
  ConsumerState<TransferPayFeeScreen> createState() =>
      _TransferPayFeeScreenState();
}

class _TransferPayFeeScreenState extends ConsumerState<TransferPayFeeScreen> {
  bool _busy = false;
  String? _error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _poll = Timer.periodic(const Duration(seconds: 4), (_) {
      ref.invalidate(transferProvider(widget.transferId));
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _pay(OwnershipTransfer transfer) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    try {
      final repo = ref.read(ownershipRepositoryProvider);
      final session = await repo.startFeeSession(transfer.id);
      if (session.isRazorpay) {
        final gateway = ref.read(paymentGatewayProvider);
        await gateway.pay(
          GatewaySession(
            keyId: session.keyId ?? '',
            gatewayOrderId: session.razorpayOrderId ?? '',
            amountPaise: session.amountPaise,
            currency: session.currency ?? 'INR',
            name: session.name ?? 'GalleryZone',
            description: session.description ?? 'Resale transfer fee',
            prefillName: session.prefillName ?? '',
            prefillEmail: session.prefillEmail ?? '',
            prefillContact: session.prefillContact ?? '',
          ),
        );
      }
      // Whatever Razorpay said (success, dismiss, error) — ask our API.
      // Only the server's re-read of the gateway order decides whether
      // the transfer finalises.
      await repo.verifyFeePayment(transfer.id);
      ref.invalidate(transferProvider(transfer.id));
      ref.invalidate(artworkTransfersProvider(transfer.artworkId));
    } catch (error) {
      if (mounted) {
        setState(() => _error = authErrorMessage(error));
        messenger.showSnackBar(SnackBar(content: Text(authErrorMessage(error))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final transfer = ref.watch(transferProvider(widget.transferId));
    return Scaffold(
      appBar: AppBar(title: const Text('Transfer fee')),
      body: transfer.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.triangleAlert,
          title: 'Something went wrong',
          description: "We couldn't open this transfer right now.",
          action: OutlinedButton(
            onPressed: () => ref.invalidate(transferProvider(widget.transferId)),
            child: const Text('Try again'),
          ),
        ),
        data: (data) {
          if (data == null) {
            return const EmptyState(
              icon: LucideIcons.unlink,
              title: "This transfer isn't available",
              description: 'It may have been cancelled, or the link is wrong.',
            );
          }
          return _Body(
            transfer: data,
            busy: _busy,
            error: _error,
            onPay: () => _pay(data),
          );
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.transfer,
    required this.busy,
    required this.error,
    required this.onPay,
  });

  final OwnershipTransfer transfer;
  final bool busy;
  final String? error;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = transfer.feeTotalPaise ?? 0;
    final royalty = transfer.royaltyPaise ?? 0;
    final platform = transfer.platformFeeNetPaise ?? 0;
    final gst = transfer.feeGstPaise ?? 0;
    final giving = transfer.givingPricePaise ?? 0;
    final confirmed = transfer.status == TransferStatus.awaitingPayment;

    if (transfer.status == TransferStatus.accepted) {
      return EmptyState(
        icon: LucideIcons.circleCheckBig,
        title: 'Transfer complete',
        description:
            '"${transfer.artworkTitle}" is now recorded to ${transfer.toName}. The artwork\'s passport shows the full chain.',
        action: FilledButton(
          onPressed: () => context.push('/verify/${transfer.artworkId}'),
          child: const Text('View the passport'),
        ),
      );
    }
    if (transfer.status == TransferStatus.cancelled) {
      return EmptyState(
        icon: LucideIcons.circleX,
        title: 'The transfer was cancelled',
        description:
            'Nothing is owed. ${transfer.toName} will not receive "${transfer.artworkTitle}".',
      );
    }

    return ContentWidth(
      maxWidth: 520,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          Text(
            confirmed
                ? '${transfer.toName} confirmed — pay to finalise'
                : 'Waiting on ${transfer.toName}',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            confirmed
                ? 'The 5% platform fee on ${formatInr(giving / 100)} is due. Pay it to pass ownership to ${transfer.toName}.'
                : "The invite was sent. We'll email you the moment ${transfer.toName} confirms, so you can pay the transfer fee.",
            style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
          ),
          const SizedBox(height: 20),
          PortalCard(
            child: Column(
              children: [
                PortalDetailRow(label: 'Artwork', value: transfer.artworkTitle),
                PortalDetailRow(
                  label: 'To',
                  value: transfer.toEmail.isEmpty
                      ? transfer.toName
                      : '${transfer.toName} · ${transfer.toEmail}',
                  gold: true,
                ),
                PortalDetailRow(
                  label: 'Giving price',
                  value: formatInr(giving / 100),
                ),
                const Divider(height: 1),
                PortalDetailRow(
                  label: 'Artist royalty (2%)',
                  value: formatInr(royalty / 100),
                ),
                PortalDetailRow(
                  label: 'GalleryZone (3%)',
                  value: formatInr(platform / 100),
                ),
                PortalDetailRow(
                  label: 'GST on the fee (18%)',
                  value: formatInr(gst / 100),
                ),
                const Divider(height: 1),
                PortalDetailRow(
                  label: 'Transfer fee',
                  value: formatInr(total / 100),
                  gold: true,
                ),
              ],
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(
              error!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          ],
          const SizedBox(height: 18),
          FilledButton(
            onPressed: (!confirmed || busy) ? null : onPay,
            child: Text(
              busy
                  ? 'Opening the payment page…'
                  : confirmed
                      ? 'Pay ${formatInr(total / 100)}'
                      : 'Waiting for ${transfer.toName} to confirm',
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'The money for the piece itself is settled between you and ${transfer.toName} off GalleryZone. GalleryZone only charges this fee, and the 2% is paid out to the original artist after.',
            style: theme.textTheme.labelSmall,
          ),
        ],
      ),
    );
  }
}
