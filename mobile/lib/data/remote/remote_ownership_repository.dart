import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/api/json_utils.dart';
import '../models/artwork.dart';
import '../models/passport.dart';
import '../repositories/ownership_repository.dart';
import 'mappers/catalog_mappers.dart';

/// Provenance and hand-overs, from the real API.
///
/// The chain is an event log on the server; a marketplace sale writes an
/// already-accepted event when the order is paid. This repository covers the
/// public reading of it (the passport) and the MANUAL hand-over: the current
/// owner invites someone by email, and that person accepts from the link.
/// The server enforces "current owner only" and "one open transfer per piece".
class RemoteOwnershipRepository implements OwnershipRepository {
  RemoteOwnershipRepository(this.api);

  final ApiClient api;

  @override
  Future<Passport?> getPassport(String artworkId) async {
    try {
      return passportFromApi(
        await api.getMap(
          '/v1/verify/${Uri.encodeComponent(artworkId)}',
          auth: false,
        ),
      );
    } on ApiError catch (error) {
      if (error.isNotFound) return null;
      rethrow;
    }
  }

  @override
  Future<MyPassports> myPassports() async =>
      myPassportsFromApi(await api.getMap('/v1/passport/mine'));

  /// The public passport already carries the whole chain (names only), so the
  /// history needs no sign-in — a scanned tag shows it to anyone.
  @override
  Future<List<OwnershipTransfer>> listForArtwork(String artworkId) async {
    final passport = await getPassport(artworkId);
    if (passport == null) return const [];
    final transfers = [
      for (final event in passport.events)
        event.toTransfer(
          artworkId: passport.artworkId,
          artworkTitle: passport.title,
        ),
    ]..sort((a, b) => b.initiatedAt.compareTo(a.initiatedAt));
    return transfers;
  }

  /// The two parties see the invite address; anyone else gets a 404 — never a
  /// 403 that would confirm the id exists.
  @override
  Future<OwnershipTransfer?> get(String transferId) async {
    try {
      return transferFromApi(
        await api.getMap('/v1/transfers/${Uri.encodeComponent(transferId)}'),
      );
    } on ApiError catch (error) {
      if (error.isNotFound) return null;
      rethrow;
    }
  }

  /// [fromName] is accepted for the interface's sake; the sender is whoever is
  /// signed in.
  @override
  Future<OwnershipTransfer> initiate({
    required String artworkId,
    required String fromName,
    required String toName,
    required String toEmail,
    TransferKind kind = TransferKind.ownership,
    String? displayStartsAt,
    String? displayEndsAt,
    int? givingPricePaise,
  }) async {
    if (kind == TransferKind.display &&
        (displayStartsAt == null ||
            displayStartsAt.isEmpty ||
            displayEndsAt == null ||
            displayEndsAt.isEmpty)) {
      throw Exception('Pick the dates the display runs from and to');
    }
    if (kind == TransferKind.display &&
        !DateTime.parse(displayEndsAt!)
            .isAfter(DateTime.parse(displayStartsAt!))) {
      throw Exception('The display end date must be after its start date');
    }
    if (kind == TransferKind.ownership &&
        (givingPricePaise == null || givingPricePaise <= 0)) {
      throw Exception('Enter the price this piece is changing hands at');
    }
    final json = await api.post(
      '/v1/artworks/${Uri.encodeComponent(artworkId)}/transfers',
      body: {
        'kind': kind.name,
        'toName': toName.trim(),
        'toEmail': toEmail.trim(),
        if (kind == TransferKind.ownership && givingPricePaise != null)
          'givingPricePaise': givingPricePaise,
        if (kind == TransferKind.display && displayStartsAt != null)
          'displayStartsAt': _midnightUtcOf(displayStartsAt),
        if (kind == TransferKind.display && displayEndsAt != null)
          'displayEndsAt': _midnightUtcOf(displayEndsAt),
      },
    );
    return transferFromApi(asMap(json));
  }

  @override
  Future<TransferFeeSession> startFeeSession(String transferId) async {
    final json = asMap(await api.post(
      '/v1/transfers/${Uri.encodeComponent(transferId)}/fee-session',
    ));
    final prefill = json['prefill'];
    final prefillMap = prefill is Map<String, dynamic> ? prefill : const <String, dynamic>{};
    return TransferFeeSession(
      mode: json['mode'] as String? ?? 'simulated',
      amountPaise: (json['amountPaise'] as num?)?.toInt() ?? 0,
      keyId: json['keyId'] as String?,
      razorpayOrderId: json['razorpayOrderId'] as String?,
      currency: json['currency'] as String?,
      name: json['name'] as String?,
      description: json['description'] as String?,
      prefillName: prefillMap['name'] as String?,
      prefillEmail: prefillMap['email'] as String?,
      prefillContact: prefillMap['contact'] as String?,
    );
  }

  @override
  Future<OwnershipTransfer> verifyFeePayment(String transferId) async =>
      transferFromApi(
        asMap(
          await api.post(
            '/v1/transfers/${Uri.encodeComponent(transferId)}/fee-verify',
          ),
        ),
      );

  /// The calendar day the person picked, as midnight UTC — what the website
  /// sends for the same date. Going through local time instead would turn
  /// "1 Nov" into 31 Oct 18:30 UTC for anyone in India.
  static String _midnightUtcOf(String picked) {
    final day = DateTime.parse(picked);
    return DateTime.utc(day.year, day.month, day.day).toIso8601String();
  }

  @override
  Future<OwnershipTransfer> accept(String transferId) async =>
      _act(transferId, 'accept');

  @override
  Future<OwnershipTransfer> endDisplay(String transferId) async =>
      _act(transferId, 'end-display');

  @override
  Future<OwnershipTransfer> cancel(String transferId) async =>
      _act(transferId, 'cancel');

  Future<OwnershipTransfer> _act(String transferId, String action) async =>
      transferFromApi(
        asMap(
          await api.post(
            '/v1/transfers/${Uri.encodeComponent(transferId)}/$action',
          ),
        ),
      );
}
