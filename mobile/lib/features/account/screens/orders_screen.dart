import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:printing/printing.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../../core/motion.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/mock/mock_checkout_repository.dart';
import '../../../data/models/order.dart';
import '../../auth/providers/auth_providers.dart';
import '../../checkout/providers/checkout_providers.dart';
import '../../marketplace/widgets/artwork_card.dart';
import '../providers/account_providers.dart';
import '../widgets/order_widgets.dart';
import '../widgets/customer_shell.dart';

/// Port of `app/account/orders/page.tsx` + `order-list.tsx`.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  static const path = '/account/orders';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      body: orders.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.packageSearch,
          title: "Couldn't load your orders",
          description: 'Something went wrong loading your order history.',
          action: OutlinedButton(
            onPressed: () => ref.invalidate(ordersProvider),
            child: const Text('Try again'),
          ),
        ),
        data: (list) => list.isEmpty
            ? EmptyState(
                icon: LucideIcons.packageSearch,
                title: 'No orders yet',
                description:
                    'Everything you buy on GalleryZone will show up here, with '
                    'full status tracking.',
                action: OutlinedButton(
                  onPressed: () => context.go(customerShopPath),
                  child: const Text('Browse the marketplace'),
                ),
              )
            : RefreshIndicator.adaptive(
                onRefresh: () => ref.refresh(ordersProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  itemCount: list.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 10),
                  itemBuilder: (context, index) =>
                      ContentWidth(child: OrderRow(order: list[index])),
                ),
              ),
      ),
    );
  }
}

/// Port of `app/account/orders/[orderId]/page.tsx` — the item, its status
/// timeline, the price breakdown, and where it's going.
/// Steps an order along its lifecycle by hand.
///
/// Nothing else moves an order in this build: there is no warehouse, courier
/// or backend behind it, so without this every purchase would sit at "Paid"
/// forever and the collection, the passport's custody record and the artist's
/// wallet would never see a delivery. Marked as a demo control on screen
/// rather than disguised as a real fulfilment update — and it disappears once
/// the order is delivered.
class _AdvanceOrderControl extends ConsumerStatefulWidget {
  const _AdvanceOrderControl({required this.order});

  final Order order;

  @override
  ConsumerState<_AdvanceOrderControl> createState() =>
      _AdvanceOrderControlState();
}

class _AdvanceOrderControlState extends ConsumerState<_AdvanceOrderControl> {
  bool _busy = false;

  Future<void> _advance() async {
    setState(() => _busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final updated = await ref
          .read(checkoutRepositoryProvider)
          .advanceOrder(widget.order.id);
      ref.invalidate(orderProvider(widget.order.id));
      ref.invalidate(ordersProvider);
      // Delivery is what fills the collection and releases the artist's money.
      ref.invalidate(collectionProvider);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            'Order is now ${OrderStatusStyle.of(updated.status).label}',
          ),
        ),
      );
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(authErrorMessage(error))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // A demo control for the offline build only: with the real backend an order
    // moves when the warehouse and the courier move it, never from here.
    if (ref.watch(remoteBackendProvider)) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final index = orderProgression.indexOf(widget.order.status);
    if (index == -1 || index == orderProgression.length - 1) {
      return const SizedBox.shrink();
    }
    final next = orderProgression[index + 1];

    return Align(
      alignment: Alignment.centerLeft,
      child: OutlinedButton.icon(
        onPressed: _busy ? null : _advance,
        icon: const Icon(LucideIcons.fastForward, size: 14),
        label: Text(
          _busy
              ? 'Updating…'
              : 'Demo: advance to ${OrderStatusStyle.of(next).label}',
          style: theme.textTheme.bodySmall,
        ),
      ),
    );
  }
}

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  static const path = '/account/orders/:orderId';

  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final order = ref.watch(orderProvider(orderId));
    final addresses = ref.watch(addressesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Order')),
      body: order.when(
        loading: () => const PageSkeleton(),
        error: (error, stack) => EmptyState(
          icon: LucideIcons.packageSearch,
          title: "Couldn't load this order",
          description: 'Something went wrong. Try again in a moment.',
          action: OutlinedButton(
            onPressed: () => ref.invalidate(orderProvider(orderId)),
            child: const Text('Try again'),
          ),
        ),
        data: (data) {
          if (data == null) {
            return const EmptyState(
              icon: LucideIcons.packageSearch,
              title: 'Order not found',
              description: 'This order is no longer in your history.',
            );
          }
          final artwork = data.artwork;
          final address = addresses.value
              ?.where((a) => a.id == data.addressId)
              .firstOrNull;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
            children: [
              ContentWidth(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Order #${data.id.length > 8 ? data.id.substring(data.id.length - 8) : data.id}',
                      style: theme.textTheme.labelMedium?.copyWith(
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (artwork != null)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            child: SizedBox(
                              width: 88,
                              height: 110,
                              child: ArtworkImageView(
                                url: artwork.thumbnailUrl,
                              ),
                            ),
                          ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                artwork?.title ?? 'Artwork no longer available',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (artwork != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  artwork.artistName,
                                  style: theme.textTheme.bodySmall,
                                ),
                              ],
                              const SizedBox(height: 8),
                              OrderStatusChip(status: data.status),
                              const SizedBox(height: 8),
                              Text(
                                'Placed ${formatLongDate(data.createdAt)}',
                                style: theme.textTheme.labelSmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (artwork != null) ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          TextButton.icon(
                            onPressed: () =>
                                context.push('/marketplace/${data.artworkId}'),
                            icon: const Icon(
                              LucideIcons.externalLink,
                              size: 14,
                            ),
                            label: const Text('View listing'),
                          ),
                          TextButton.icon(
                            onPressed: () =>
                                context.push('/verify/${data.artworkId}'),
                            icon: const Icon(LucideIcons.scanLine, size: 14),
                            label: const Text('Passport'),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 24),
                    OrderStatusTimeline(history: data.statusHistory),
                    const SizedBox(height: 12),
                    _AdvanceOrderControl(order: data),
                    const SizedBox(height: 28),
                    OrderPriceBreakdown(order: data),
                    const SizedBox(height: 28),
                    Text('Delivery address', style: theme.textTheme.titleLarge),
                    const SizedBox(height: 10),
                    Text(
                      address != null
                          ? [
                              address.line1,
                              address.line2,
                              '${address.city}, ${address.state} ${address.pincode}',
                            ].whereType<String>().join('\n')
                          : addresses.isLoading
                          ? 'Loading address…'
                          : 'This address is no longer on file.',
                      style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                    ),

                    // Tax invoice is only valid once the order is paid (web
                    // parity, audit §9). Fetches the server-rendered PDF and
                    // hands it to the OS share sheet so the user can save,
                    // print or email it from their own apps.
                    const SizedBox(height: 28),
                    _TaxInvoiceCard(order: data),

                    // A paid order can be refunded; a pending or cancelled
                    // one either hasn't been charged or has already been
                    // auto-refunded by the gateway. The dialog creates a
                    // support ticket with the order context pre-filled, so
                    // the customer only writes the reason. Mirrors the web
                    // RequestRefundDialog (31 Oct 2026).
                    if (data.status != OrderStatus.pending &&
                        data.status != OrderStatus.cancelled) ...[
                      const SizedBox(height: 28),
                      Text(
                        'Something wrong?',
                        style: theme.textTheme.titleLarge,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        "Request a refund and support will take a look. Keep the artwork for now — don't return anything until support replies.",
                        style: theme.textTheme.bodySmall?.copyWith(
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: () => _openRefundDialog(context, ref, data),
                        icon: const Icon(
                          LucideIcons.undo2,
                          size: 14,
                        ),
                        label: const Text('Request a refund'),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openRefundDialog(
    BuildContext context,
    WidgetRef ref,
    Order order,
  ) async {
    final submitted = await showDialog<bool>(
      context: context,
      builder: (ctx) => _RequestRefundDialog(order: order),
    );
    if (submitted == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Request sent — support replies by email, usually within a working day.',
          ),
        ),
      );
    }
  }
}

/// Dialog mirror of the web `RequestRefundDialog`. Submits a support ticket
/// with the order id, artwork and amount pre-filled; the customer only
/// writes the reason. Validation matches the web: at least 5 trimmed chars.
class _RequestRefundDialog extends ConsumerStatefulWidget {
  const _RequestRefundDialog({required this.order});

  final Order order;

  @override
  ConsumerState<_RequestRefundDialog> createState() =>
      _RequestRefundDialogState();
}

class _RequestRefundDialogState extends ConsumerState<_RequestRefundDialog> {
  final _reason = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final trimmed = _reason.text.trim();
    if (trimmed.length < 5) {
      setState(() => _error = 'Add a few lines about the problem');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final subject =
          'Refund request — Order ${widget.order.id.length > 8 ? widget.order.id.substring(widget.order.id.length - 8) : widget.order.id}';
      final message = [
        'Order: ${widget.order.id}',
        'Artwork: ${widget.order.artwork?.title ?? "Artwork"}',
        'Total paid: ${formatInr(widget.order.total)}',
        '',
        'Reason:',
        trimmed,
      ].join('\n');
      await ref
          .read(customerRepositoryProvider)
          .submitSupportTicket(subject: subject, message: message);
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      setState(() {
        _error = error.toString();
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Request a refund'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "Tell support what's wrong with this order. They'll reply by email, usually within a working day.",
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _reason,
              maxLines: 5,
              maxLength: 2000,
              enabled: !_busy,
              decoration: InputDecoration(
                labelText: 'Reason',
                hintText: "What's wrong? The more detail the better.",
                errorText: _error,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "We'll include the order id, the artwork, and the amount in your request so you don't have to.",
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Send request'),
        ),
      ],
    );
  }
}

/// Tax-invoice download card — matches the web DownloadInvoiceButton. The
/// server stamps the invoice number on first fetch and keeps it on the
/// order, so re-downloading always returns the same document.
///
/// A pending or cancelled order has no invoice to issue, so the button is
/// disabled with the same reason the web shows.
class _TaxInvoiceCard extends ConsumerStatefulWidget {
  const _TaxInvoiceCard({required this.order});

  final Order order;

  @override
  ConsumerState<_TaxInvoiceCard> createState() => _TaxInvoiceCardState();
}

class _TaxInvoiceCardState extends ConsumerState<_TaxInvoiceCard> {
  bool _busy = false;

  bool get _available =>
      widget.order.status != OrderStatus.pending &&
      widget.order.status != OrderStatus.cancelled;

  Future<void> _download() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(customerRepositoryProvider)
          .downloadInvoice(widget.order.id);
      // Hand the PDF to the OS share sheet: user can save, print, mail or
      // open it in any PDF viewer. No app-side storage of PII.
      await Printing.sharePdf(
        bytes: Uint8List.fromList(result.bytes),
        filename: result.filename,
      );
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                LucideIcons.receipt,
                size: 16,
                color: theme.colorScheme.tertiary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Tax invoice',
                  style: theme.textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            _available
                ? 'GST-compliant tax invoice for this order.'
                : 'An invoice is issued once your payment is confirmed.',
            style: theme.textTheme.bodySmall?.copyWith(height: 1.4),
          ),
          const SizedBox(height: 10),
          Tooltip(
            message: _available
                ? ''
                : 'Invoice available once your payment is confirmed',
            child: OutlinedButton.icon(
              onPressed: _available && !_busy ? _download : null,
              icon: _busy
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(LucideIcons.download, size: 14),
              label: Text(_busy ? 'Fetching invoice…' : 'Download invoice'),
            ),
          ),
        ],
      ),
    );
  }
}
