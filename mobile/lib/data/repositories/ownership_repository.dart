import '../models/artwork.dart';
import '../models/passport.dart';

/// What the sender's 5% fee checkout returns. Mirrors the API JSON — the
/// Razorpay fields are only populated when PAYMENTS_MODE=razorpay; in
/// simulated mode only [amountPaise] + [mode] are meaningful.
class TransferFeeSession {
  const TransferFeeSession({
    required this.mode,
    required this.amountPaise,
    this.keyId,
    this.razorpayOrderId,
    this.currency,
    this.name,
    this.description,
    this.prefillName,
    this.prefillEmail,
    this.prefillContact,
  });

  final String mode;
  final int amountPaise;
  final String? keyId;
  final String? razorpayOrderId;
  final String? currency;
  final String? name;
  final String? description;
  final String? prefillName;
  final String? prefillEmail;
  final String? prefillContact;

  bool get isRazorpay => mode == 'razorpay';
}

/// Digital ownership hand-over for an artwork's passport, mirroring
/// `services/ownershipService.ts`.
///
/// Its own interface rather than methods bolted onto [ArtworkRepository] or
/// [CustomerRepository]: the reads are public (anyone scanning a tag sees the
/// chain of custody), the writes are owner-scoped, and splitting one concept
/// across two interfaces to honour that would be worse than a small third one.
abstract class OwnershipRepository {
  /// Every transfer recorded against an artwork, newest first.
  Future<List<OwnershipTransfer>> listForArtwork(String artworkId);

  /// The transfer behind an accept link. Null when the link is not valid.
  Future<OwnershipTransfer?> get(String transferId);

  /// Starts a hand-over. Only one can be open per artwork — two pending
  /// transfers would let two people each claim the same piece.
  ///
  /// [kind] picks what is being handed over. A display transfer needs
  /// [displayStartsAt], [displayEndsAt] and leaves the owner unchanged.
  /// A priced ownership transfer needs [givingPricePaise]; the recipient
  /// must already have a GalleryZone account on [toEmail].
  Future<OwnershipTransfer> initiate({
    required String artworkId,
    required String fromName,
    required String toName,
    required String toEmail,
    TransferKind kind,
    String? displayStartsAt,
    String? displayEndsAt,
    int? givingPricePaise,
  });

  /// Opens the Razorpay checkout for the sender's 5% platform fee. Returns
  /// the pieces the Razorpay Flutter plugin needs plus the exact amount.
  Future<TransferFeeSession> startFeeSession(String transferId);

  /// Called after the sender returns from Razorpay. Server-side re-reads
  /// the gateway order and finalises the transfer if it is paid.
  Future<OwnershipTransfer> verifyFeePayment(String transferId);

  /// The buyer accepting is what actually moves ownership: nothing changes on
  /// the artwork until this runs. A display transfer accepted here moves
  /// nothing at all — custody on display is derived from the record and the
  /// date, so there is no state to write and none to unwind at expiry.
  Future<OwnershipTransfer> accept(String transferId);

  /// The owner pulling a piece back before the end date. The alternative —
  /// the date passing — needs no call at all.
  Future<OwnershipTransfer> endDisplay(String transferId);

  Future<OwnershipTransfer> cancel(String transferId);

  /// The public passport — what a printed QR code or NFC tag resolves to.
  /// Readable by anyone, with names only (never a price, email or address).
  /// Null when there is no such piece.
  Future<Passport?> getPassport(String artworkId);

  /// The passports of every piece the signed-in person owns, made, or holds
  /// on display, each with how they relate to it.
  Future<MyPassports> myPassports();
}
