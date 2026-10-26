import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/artwork_card.dart';
import '../../shell/portal_widgets.dart';
import '../providers/aggregator_providers.dart';

/// Read-only earnings overview matching the current website decision.
///
/// There is no prepaid aggregator wallet, top-up control, or withdrawal
/// request. The aggregator pays the deposit and delivery charge for each piece
/// directly through Razorpay when reserving it. GalleryZone transfers cleared
/// commission to the verified bank account and records the bank reference in
/// the transaction feed.
class AggregatorWalletScreen extends ConsumerWidget {
  const AggregatorWalletScreen({super.key});

  static const path = '/aggregator/earnings';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final walletAsync = ref.watch(aggregatorWalletProvider);
    final transactionsAsync = ref.watch(aggregatorWalletTransactionsProvider);
    final profile = ref.watch(aggregatorProfileProvider).value;
    final wallet = walletAsync.value;
    final transactions = transactionsAsync.value;

    if (wallet == null && walletAsync.hasError) {
      return Scaffold(
        appBar: AppBar(title: const Text('Earnings')),
        body: EmptyState(
          icon: LucideIcons.triangleAlert,
          title: "Couldn't load your earnings",
          description: authErrorMessage(walletAsync.error!),
          action: OutlinedButton(
            onPressed: () {
              ref.invalidate(aggregatorWalletProvider);
              ref.invalidate(aggregatorWalletTransactionsProvider);
              ref.invalidate(aggregatorProfileProvider);
            },
            child: const Text('Try again'),
          ),
        ),
      );
    }

    final locked = wallet?.lockedBalance ?? 0;
    final owed = (wallet?.balance ?? 0) - locked;

    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(aggregatorWalletProvider);
          ref.invalidate(aggregatorWalletTransactionsProvider);
          ref.invalidate(aggregatorProfileProvider);
          await ref.read(aggregatorWalletProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            ContentWidth(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _SummaryCard(
                    label: 'Owed to you',
                    value: owed,
                    hint: 'Commission GalleryZone will transfer to your bank',
                    icon: LucideIcons.wallet,
                    gold: true,
                  ),
                  const SizedBox(height: 10),
                  _SummaryCard(
                    label: 'Held against reservations',
                    value: locked,
                    hint: 'Advances and delivery you paid on displayed pieces',
                    icon: LucideIcons.lock,
                  ),
                  const SizedBox(height: 10),
                  _SummaryCard(
                    label: 'Commission clearing',
                    value: wallet?.pendingBalance ?? 0,
                    hint: 'Earned on sales, waiting for delivery to confirm',
                    icon: LucideIcons.clock3,
                  ),
                  const SizedBox(height: 16),
                  const _MoneyFlowCard(),
                  const SizedBox(height: 16),
                  _PayoutDestinationCard(
                    bankAccountMasked: profile?.bankAccountMasked ?? '',
                    ifsc: profile?.ifsc ?? '',
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Transaction history',
                    style: theme.textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  if (transactions == null && transactionsAsync.hasError)
                    EmptyState(
                      icon: LucideIcons.triangleAlert,
                      title: "Couldn't load your transactions",
                      description: authErrorMessage(transactionsAsync.error!),
                      action: OutlinedButton(
                        onPressed: () => ref.invalidate(
                          aggregatorWalletTransactionsProvider,
                        ),
                        child: const Text('Try again'),
                      ),
                    )
                  else if (transactions == null)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  else if (transactions.isEmpty)
                    const EmptyState(
                      icon: LucideIcons.wallet,
                      title: 'No transactions yet',
                      description:
                          'Commission and settlement records will appear here.',
                    )
                  else
                    for (final transaction in transactions)
                      WalletTransactionRow(transaction: transaction),
                  const SizedBox(height: 24),
                  if (profile != null)
                    GstNumberCard(
                      value: profile.gstNumber,
                      description: 'Used on your commission settlements and invoices. Also editable from your profile.',
                      onSave: (gstNumber) async {
                        await ref
                            .read(aggregatorRepositoryProvider)
                            .updateProfile(
                              profile.copyWith(gstNumber: gstNumber),
                            );
                        ref.invalidate(aggregatorProfileProvider);
                      },
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.hint,
    required this.icon,
    this.gold = false,
  });

  final String label;
  final double value;
  final String hint;
  final IconData icon;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PortalCard(
      gold: gold,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label, style: theme.textTheme.bodySmall)),
              Icon(
                icon,
                size: 16,
                color: gold
                    ? theme.colorScheme.tertiary
                    : theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
          const SizedBox(height: 10),
          PriceTag(amount: value, style: theme.textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(hint, style: theme.textTheme.labelSmall),
        ],
      ),
    );
  }
}

class _MoneyFlowCard extends StatelessWidget {
  const _MoneyFlowCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PortalCard(
      gold: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.wallet, color: theme.colorScheme.tertiary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'How the money moves',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Pay the deposit and delivery for each piece when you reserve it through Razorpay. '
                  'GalleryZone holds the sale amount in escrow, settles the artist share, and transfers '
                  'your cleared commission to your bank. There is no wallet top-up or withdrawal request.',
                  style: theme.textTheme.bodySmall?.copyWith(height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PayoutDestinationCard extends StatelessWidget {
  const _PayoutDestinationCard({
    required this.bankAccountMasked,
    required this.ifsc,
  });

  final String bankAccountMasked;
  final String ifsc;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasBank = bankAccountMasked.trim().isNotEmpty;
    return PortalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Where your commission lands',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          if (hasBank)
            Row(
              children: [
                Icon(
                  LucideIcons.building2,
                  color: theme.colorScheme.tertiary,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(bankAccountMasked),
                      if (ifsc.isNotEmpty)
                        Text(ifsc, style: theme.textTheme.labelSmall),
                    ],
                  ),
                ),
              ],
            )
          else
            Text(
              'Add a bank account on your Profile so GalleryZone can send your commission.',
              style: theme.textTheme.bodySmall,
            ),
          const SizedBox(height: 12),
          Text(
            'GalleryZone transfers cleared commission after each sale. No request is needed on your side.',
            style: theme.textTheme.labelSmall?.copyWith(height: 1.5),
          ),
        ],
      ),
    );
  }
}
