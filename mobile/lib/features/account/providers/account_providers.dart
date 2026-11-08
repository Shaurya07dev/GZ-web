import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/mock/mock_customer_repository.dart';
import '../../../data/models/artwork.dart';
import '../../../data/models/cart.dart';
import '../../../data/models/customer.dart';
import '../../../data/models/notification_inbox.dart';
import '../../../data/models/notification_prefs.dart';
import '../../../data/models/order.dart';
import '../../../data/repositories/customer_repository.dart';
import '../../checkout/providers/checkout_providers.dart';

final customerRepositoryProvider = Provider<CustomerRepository>((ref) {
  return MockCustomerRepository();
});

/// Every read below is `autoDispose`: orders, wallet balance and addresses
/// are exactly the state SAD §9.2 says is never cached client-side. Nothing
/// here is pinned in app-wide state.
final customerProfileProvider = FutureProvider.autoDispose<CustomerProfile>((
  ref,
) {
  return ref.watch(customerRepositoryProvider).getProfile();
});

final addressesProvider = FutureProvider.autoDispose<List<Address>>((ref) {
  return ref.watch(customerRepositoryProvider).listAddresses();
});

final ordersProvider = FutureProvider.autoDispose<List<Order>>((ref) async {
  final orders = await ref.watch(checkoutRepositoryProvider).listOrders();
  // Newest first — the list, the dashboard's "recent orders" and any future
  // caller all want the same order, so it's sorted once here.
  final sorted = [...orders]..sort(
    (a, b) =>
        DateTime.parse(b.createdAt).compareTo(DateTime.parse(a.createdAt)),
  );
  // Collapse duplicate pending orders for the same artwork. Backend's
  // createOrder dedupes going forward (one pending per customer+artwork),
  // but any legacy duplicates in Firestore from before that check still
  // show up — keep only the newest, so the list reads as "one abandoned
  // checkout per piece" instead of a messy stack. Paid/delivered orders
  // are always kept (the same piece could legitimately be bought twice if
  // resold later).
  final seenPending = <String>{};
  return [
    for (final order in sorted)
      if (order.status != OrderStatus.pending ||
          seenPending.add(order.artworkId))
        order,
  ];
});

final orderProvider = FutureProvider.autoDispose.family<Order?, String>((
  ref,
  id,
) {
  return ref.watch(checkoutRepositoryProvider).getOrder(id);
});

final walletProvider = FutureProvider.autoDispose<WalletSummary>((ref) {
  return ref.watch(customerRepositoryProvider).getWallet();
});

final walletTransactionsProvider =
    FutureProvider.autoDispose<List<WalletTransaction>>((ref) {
      return ref.watch(customerRepositoryProvider).listWalletTransactions();
    });

final collectionProvider = FutureProvider.autoDispose<List<CollectionItem>>((
  ref,
) {
  return ref.watch(customerRepositoryProvider).listCollection();
});

final physicalCoaRequestsProvider =
    FutureProvider.autoDispose<List<PhysicalCoaRequest>>((ref) {
      return ref.watch(customerRepositoryProvider).listPhysicalCoaRequests();
    });

final resaleListingsProvider = FutureProvider.autoDispose<List<ResaleListing>>((
  ref,
) {
  return ref.watch(customerRepositoryProvider).listResaleListings();
});

final supportTicketsProvider = FutureProvider.autoDispose<List<SupportTicket>>((
  ref,
) {
  return ref.watch(customerRepositoryProvider).listSupportTickets();
});

/// `Aarav Shah` -> `AS`. `CustomerProfile` carries no avatar field, so the
/// profile chip renders initials rather than a placeholder photo — the more
/// honest treatment of a field the data model doesn't have.
String initials(String name) => name
    .trim()
    .split(RegExp(r'\s+'))
    .where((part) => part.isNotEmpty)
    .take(2)
    .map((part) => part[0].toUpperCase())
    .join();

/// The signed-in user's cart — refreshed on write by the mutator below.
/// In-app notifications inbox — the same /v1/notifications list the web
/// polls. Refreshed on pull-to-refresh on the inbox screen; invalidated
/// after marking rows read so the AppBar bell's unread badge updates.
final notificationsProvider =
    FutureProvider.autoDispose<NotificationInbox>((ref) {
  return ref.watch(customerRepositoryProvider).getNotifications();
});

final cartProvider = FutureProvider.autoDispose<Cart>((ref) {
  return ref.watch(customerRepositoryProvider).getCart();
});

/// Opt-in notification categories (abandonedCart, marketing, weeklyDigest,
/// pushEnabled). Transactional emails bypass this.
final notificationPreferencesProvider =
    FutureProvider.autoDispose<NotificationPreferences>((ref) {
  return ref.watch(customerRepositoryProvider).getNotificationPreferences();
});
