/// Per-user notification preferences, same shape as the web.
/// Transactional emails (order confirmation, invoice, password reset) are
/// always sent — these controls only cover opt-in categories.
class NotificationPreferences {
  const NotificationPreferences({
    required this.abandonedCart,
    required this.marketing,
    required this.weeklyDigest,
    required this.pushEnabled,
  });

  final bool abandonedCart;
  final bool marketing;
  final bool weeklyDigest;
  final bool pushEnabled;

  NotificationPreferences copyWith({
    bool? abandonedCart,
    bool? marketing,
    bool? weeklyDigest,
    bool? pushEnabled,
  }) => NotificationPreferences(
    abandonedCart: abandonedCart ?? this.abandonedCart,
    marketing: marketing ?? this.marketing,
    weeklyDigest: weeklyDigest ?? this.weeklyDigest,
    pushEnabled: pushEnabled ?? this.pushEnabled,
  );

  factory NotificationPreferences.fromJson(Map<String, dynamic> json) =>
      NotificationPreferences(
        abandonedCart: json['abandonedCart'] == true,
        marketing: json['marketing'] == true,
        weeklyDigest: json['weeklyDigest'] == true,
        pushEnabled: json['pushEnabled'] != false,
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
    'abandonedCart': abandonedCart,
    'marketing': marketing,
    'weeklyDigest': weeklyDigest,
    'pushEnabled': pushEnabled,
  };
}
