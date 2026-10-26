import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/adaptive.dart';
import '../../../core/format.dart';
import '../../../core/pricing.dart';
import '../../../data/mock/mock_artist_repository.dart'
    show simulateDeliveryAndRelease;
import '../../../data/models/artist_portal.dart';
import '../../auth/providers/auth_providers.dart';
import '../../marketplace/widgets/artwork_card.dart';
import '../../shell/portal_widgets.dart';
import '../providers/artist_providers.dart';
import '../widgets/artist_widgets.dart';

/// Read-only earnings overview. GalleryZone pays eligible settlements to the
/// verified bank account; the current product no longer exposes an app wallet
/// or manual withdrawal request.
class ArtistWalletTab extends ConsumerWidget {
  const ArtistWalletTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final walletAsync = ref.watch(artistWalletProvider);
    final transactionsAsync = ref.watch(artistWalletTransactionsProvider);
    final wallet = walletAsync.value;

    if (wallet == null && walletAsync.hasError) {
      return EmptyState(
        icon: LucideIcons.triangleAlert,
        title: "Couldn't load your earnings",
        description: authErrorMessage(walletAsync.error!),
        action: OutlinedButton(
          onPressed: () {
            ref.invalidate(artistWalletProvider);
            ref.invalidate(artistWalletTransactionsProvider);
          },
          child: const Text('Try again'),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(artistWalletProvider);
        ref.invalidate(artistWalletTransactionsProvider);
        ref.invalidate(artistSettlementsProvider);
        await ref.read(artistWalletProvider.future);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          ContentWidth(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PortalCard(
                  gold: true,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            LucideIcons.landmark,
                            size: 16,
                            color: theme.colorScheme.tertiary,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Eligible for bank payout',
                              style: theme.textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      PriceTag(
                        amount: wallet?.balance ?? 0,
                        style: theme.textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 10),
                      PortalDetailRow(
                        label: 'Awaiting delivery',
                        value: formatInr(wallet?.pendingBalance ?? 0),
                      ),
                      PortalDetailRow(
                        label: 'Locked',
                        value: formatInr(wallet?.lockedBalance ?? 0),
                      ),
                      const SizedBox(height: 12),
                      const PortalNotice(
                        icon: LucideIcons.landmark,
                        title: 'Automatic bank payout',
                        body:
                            'GalleryZone sends eligible settlements to your verified bank account. There is no '
                            'prepaid wallet or manual withdrawal request.',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const _PendingSettlements(),
                Text('Settlement history', style: theme.textTheme.titleLarge),
                const SizedBox(height: 8),
                if (transactionsAsync.value == null &&
                    transactionsAsync.hasError)
                  EmptyState(
                    icon: LucideIcons.triangleAlert,
                    title: "Couldn't load your settlement history",
                    description: authErrorMessage(transactionsAsync.error!),
                    action: OutlinedButton(
                      onPressed: () =>
                          ref.invalidate(artistWalletTransactionsProvider),
                      child: const Text('Try again'),
                    ),
                  )
                else if (transactionsAsync.value == null)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (transactionsAsync.requireValue.isEmpty)
                  const EmptyState(
                    icon: LucideIcons.wallet,
                    title: 'No settlements yet',
                    description:
                        'Payouts and settlement adjustments will show up here.',
                  )
                else
                  for (final transaction in transactionsAsync.requireValue)
                    WalletTransactionRow(transaction: transaction),
                const SizedBox(height: 24),
                Consumer(
                  builder: (context, ref, _) {
                    final profile = ref
                        .watch(artistProfileDetailsProvider)
                        .value;
                    if (profile == null) return const SizedBox.shrink();
                    return GstNumberCard(
                      value: profile.gstin ?? '',
                      description: 'Used on your settlement statements and invoices. Also editable from your profile.',
                      onSave: (gstin) async {
                        await ref
                            .read(artistRepositoryProvider)
                            .updateProfile(profile.copyWith(gstin: gstin));
                        ref.invalidate(artistProfileDetailsProvider);
                      },
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// What is waiting on the 7-day clock, and when each piece of it lands. Money
/// from a sale clears seven days after the artwork reaches the buyer, so this
/// card answers "where is my money" before the artist has to ask.
///
/// The "mark delivered" button is a demo shortcut for the offline build only -
/// there is no courier there, so nothing would ever mark a delivery long enough
/// ago for the seven days to have elapsed. Against the real service a delivery
/// is recorded by the operations team and the button is not offered.
class _PendingSettlements extends ConsumerWidget {
  const _PendingSettlements();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final remote = ref.watch(remoteBackendProvider);
    final settlements = ref.watch(artistSettlementsProvider).value ?? const [];
    final pending = [
      for (final settlement in settlements)
        if (settlement.status == SettlementStatus.pending) settlement,
    ];
    if (pending.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('On the way to you', style: theme.textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            'Sales clear $artistPayoutDaysAfterDelivery days after the artwork is delivered to the buyer.',
            style: theme.textTheme.bodySmall?.copyWith(height: 1.45),
          ),
          const SizedBox(height: 10),
          for (final settlement in pending)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: PortalCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            settlement.artworkTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        PriceTag(
                          amount: settlement.artistAmount,
                          style: theme.textTheme.bodyMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      settlement.releaseAfter == null
                          ? 'Waiting for the artwork to be delivered'
                          : 'Delivered — clears ${formatDay(settlement.releaseAfter!)}',
                      style: theme.textTheme.labelSmall?.copyWith(height: 1.45),
                    ),
                    if (!remote && settlement.releaseAfter == null) ...[
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 36,
                        child: OutlinedButton(
                          onPressed: () =>
                              _simulate(context, ref, settlement.id),
                          child: const Text('Simulate delivery (demo)'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _simulate(BuildContext context, WidgetRef ref, String settlementId) {
    // Backdates the delivery far enough that the seven days have already run,
    // then releases - otherwise this button would appear to do nothing.
    simulateDeliveryAndRelease(settlementId);
    ref.invalidate(artistWalletProvider);
    ref.invalidate(artistWalletTransactionsProvider);
    ref.invalidate(artistSettlementsProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Delivered and released to your balance')),
    );
  }
}
