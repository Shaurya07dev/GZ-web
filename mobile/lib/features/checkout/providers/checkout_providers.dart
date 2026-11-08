import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/payments/payment_gateway.dart';
import '../../../data/mock/mock_checkout_repository.dart';
import '../../../data/models/order.dart';
import '../../../data/repositories/checkout_repository.dart';

final checkoutRepositoryProvider = Provider<CheckoutRepository>((ref) {
  return MockCheckoutRepository();
});

/// The payment sheet. `main()` registers the real one; until then (and in
/// every test) it is a stand-in that says online payment isn't available.
final paymentGatewayProvider = Provider<PaymentGateway>((ref) {
  return const UnavailablePaymentGateway();
});

/// What an artwork costs at checkout, quoted by the server from the pricing
/// rules in force right now — price (GST inside), the convenience fee and its
/// GST, delivery, total. The review and payment steps show exactly this, so a
/// preview can never disagree with the order that follows.
///
/// Keyed by artwork only; the delivery here is the flat fallback shown on
/// artwork detail before an address exists. Use [addressedCheckoutQuoteProvider]
/// once the buyer picks an address — same shape, but with the real
/// Shiprocket rate for that pincode.
final checkoutQuoteProvider = FutureProvider.autoDispose
    .family<CheckoutQuote, String>((ref, artworkId) {
      return ref.watch(checkoutRepositoryProvider).getQuote(artworkId);
    });

/// `(artworkId, addressId)` pair — Riverpod's `.family` wants a single arg.
class AddressedQuoteKey {
  const AddressedQuoteKey({required this.artworkId, required this.addressId});
  final String artworkId;
  final String addressId;

  @override
  bool operator ==(Object other) =>
      other is AddressedQuoteKey &&
      other.artworkId == artworkId &&
      other.addressId == addressId;

  @override
  int get hashCode => Object.hash(artworkId, addressId);
}

/// Address-aware checkout quote — the review and payment steps watch this
/// so the delivery charge on screen is the same number `POST /v1/orders`
/// will debit. Reruns whenever the buyer picks a different saved address.
final addressedCheckoutQuoteProvider = FutureProvider.autoDispose
    .family<CheckoutQuote, AddressedQuoteKey>((ref, key) {
      return ref.watch(checkoutRepositoryProvider).getQuote(
            key.artworkId,
            addressId: key.addressId,
          );
    });
