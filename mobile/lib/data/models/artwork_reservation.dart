/// Live concurrent-buyer reservation state for one artwork. Mirrors the
/// backend `GET /v1/artworks/:id/reservation` response shape.
///
/// A reservation lasts 10 minutes from the moment a buyer clicks Buy Now;
/// during that window no other buyer can create an order for the same
/// piece. When nothing is held the view carries [reserved]=false and
/// null id/countdown.
class ArtworkReservation {
  const ArtworkReservation({
    required this.reserved,
    required this.heldByCustomerId,
    required this.expiresAt,
    required this.secondsRemaining,
  });

  /// Whether SOMEONE (either this viewer or another collector) holds a
  /// currently-valid reservation on the artwork.
  final bool reserved;

  /// The uid that holds the reservation; null when nothing is held.
  /// Compare against the current signed-in uid to tell "my hold" from
  /// "someone else's hold".
  final String? heldByCustomerId;

  /// ISO-8601 timestamp when the hold expires. Null when nothing is held.
  final String? expiresAt;

  /// Seconds the backend thinks are left on the hold at the moment this
  /// response was generated. The UI refetches every ~10s, so a running
  /// countdown shown in the UI should be updated from this value on each
  /// poll rather than extrapolated client-side (which would drift during
  /// clock skew).
  final int secondsRemaining;

  factory ArtworkReservation.unreserved() => const ArtworkReservation(
    reserved: false,
    heldByCustomerId: null,
    expiresAt: null,
    secondsRemaining: 0,
  );

  factory ArtworkReservation.fromJson(Map<String, dynamic> json) {
    return ArtworkReservation(
      reserved: json['reserved'] as bool? ?? false,
      heldByCustomerId: json['heldByCustomerId'] as String?,
      expiresAt: json['expiresAt'] as String?,
      secondsRemaining: (json['secondsRemaining'] as num?)?.toInt() ?? 0,
    );
  }
}
